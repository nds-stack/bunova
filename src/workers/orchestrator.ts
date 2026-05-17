import type { WorkerOptions, WorkerHandle, WorkerPoolStats } from "../types.ts"

const BACKOFF_INITIAL = 1_000
const BACKOFF_MAX = 30_000

export class WorkerOrchestrator {
  #nextWorkerId = 0
  #workers = new Map<string, WorkerHandle>()
  #workerProcesses = new Map<string, Bun.Subprocess>()
  #options = new Map<string, WorkerOptions>()
  #requestCounts = new Map<string, number>()
  #healthTimers = new Map<string, Timer>()

  get list(): WorkerHandle[] {
    return Array.from(this.#workers.values())
  }

  get count(): number {
    return this.#workers.size
  }

  stats(): WorkerPoolStats {
    let running = 0
    let stopped = 0
    let crashed = 0
    let healthy = 0
    let unhealthy = 0
    let totalMemory = 0
    let memoryCount = 0

    for (const w of this.#workers.values()) {
      switch (w.status) {
        case "running": running++; break
        case "stopped": stopped++; break
        case "crashed": crashed++; break
      }
      if (w.healthStatus === "healthy") healthy++
      if (w.healthStatus === "unhealthy") unhealthy++
      if (w.memory !== null) {
        totalMemory += w.memory
        memoryCount++
      }
    }

    return {
      total: this.#workers.size,
      running,
      stopped,
      crashed,
      healthy,
      unhealthy,
      averageMemory: memoryCount > 0 ? totalMemory / memoryCount : null,
    }
  }

  async spawn(path: string, options: WorkerOptions = {}): Promise<WorkerHandle> {
    const id = `worker-${++this.#nextWorkerId}`
    const count = options.count ?? 1
    const handles: WorkerHandle[] = []

    for (let i = 0; i < count; i++) {
      const workerId = count > 1 ? `${id}-${i}` : id
      const handle: WorkerHandle = {
        id: workerId,
        path,
        pid: null,
        status: "spawning",
        startedAt: null,
        restarts: 0,
        requests: 0,
        memory: null,
        healthStatus: "unknown",
      }

      this.#workers.set(workerId, handle)
      this.#options.set(workerId, options)
      this.#requestCounts.set(workerId, 0)
      handles.push(handle)

      this.#startWorker(workerId, path, options).catch(() => {})
    }

    return handles[0]!
  }

  #calculateBackoff(restarts: number): number {
    const delay = BACKOFF_INITIAL * Math.pow(2, restarts - 1)
    return Math.min(delay, BACKOFF_MAX)
  }

  #shouldRestart(handle: WorkerHandle, options: WorkerOptions): boolean {
    if (options.restart === false) return false
    const maxRestarts = options.maxRestarts ?? 10
    return handle.restarts < maxRestarts
  }

  async #startWorker(id: string, path: string, options: WorkerOptions): Promise<void> {
    const handle = this.#workers.get(id)
    if (!handle) return

    // Apply exponential backoff if restarting
    if (handle.restarts > 0) {
      const delay = this.#calculateBackoff(handle.restarts)
      await Bun.sleep(delay)
    }

    try {
      const proc = Bun.spawn(["bun", "run", path], {
        env: { ...process.env, ...options.env, BUNOVA_WORKER_ID: id },
        stdio: ["ignore", "pipe", "pipe"],
      })

      this.#workerProcesses.set(id, proc)
      handle.pid = proc.pid ?? null
      handle.status = "running"
      handle.startedAt = new Date().toISOString()
      handle.healthStatus = "healthy"

      if (options.healthcheck) {
        this.#startHealthcheck(id, options.healthcheck)
        // Fire initial healthcheck immediately
        this.#checkHealth(id, options.healthcheck.interval)
      }

      const exitCode = await proc.exited
      handle.status = exitCode === 0 ? "stopped" : "crashed"
      handle.healthStatus = "unknown"
      this.#stopHealthcheck(id)

      if (exitCode !== 0 && this.#shouldRestart(handle, options)) {
        handle.restarts++
        this.#startWorker(id, path, options).catch(() => {})
      }
    } catch {
      handle.status = "crashed"
      handle.healthStatus = "unhealthy"
      this.#stopHealthcheck(id)
      if (this.#shouldRestart(handle, options)) {
        handle.restarts++
        this.#startWorker(id, path, options).catch(() => {})
      }
    }
  }

  #startHealthcheck(id: string, config: NonNullable<WorkerOptions["healthcheck"]>): void {
    const timer = setInterval(() => {
      const proc = this.#workerProcesses.get(id)
      const handle = this.#workers.get(id)
      if (!proc || !handle || handle.status !== "running") return

      const alive = proc.killed === false && proc.exitCode === null
      if (alive) {
        handle.healthStatus = "healthy"
      } else {
        handle.healthStatus = "unhealthy"
        this.#stopHealthcheck(id)
        const options = this.#options.get(id)
        if (options && this.#shouldRestart(handle, options)) {
          handle.restarts++
          this.#startWorker(id, handle.path, options).catch(() => {})
        }
      }
    }, config.interval)
    timer.unref()

    this.#healthTimers.set(id, timer)
  }

  #checkHealth(id: string, _interval: number): void {
    const handle = this.#workers.get(id)
    const proc = this.#workerProcesses.get(id)
    if (!handle || !proc) return

    const alive = proc.killed === false && proc.exitCode === null
    handle.healthStatus = alive ? "healthy" : "unhealthy"
    if (!alive) {
      this.#stopHealthcheck(id)
      const options = this.#options.get(id)
      if (options && this.#shouldRestart(handle, options)) {
        handle.restarts++
        this.#startWorker(id, handle.path, options).catch(() => {})
      }
    }
  }

  #stopHealthcheck(id: string): void {
    const timer = this.#healthTimers.get(id)
    if (timer) {
      clearInterval(timer)
      this.#healthTimers.delete(id)
    }
  }

  incrementRequests(id: string): void {
    const handle = this.#workers.get(id)
    const options = this.#options.get(id)
    if (!handle || !options) return

    handle.requests++
    this.#requestCounts.set(id, (this.#requestCounts.get(id) ?? 0) + 1)

    if (options.recycle?.maxRequests && handle.requests >= options.recycle.maxRequests) {
      this.#restartOne(id)
    }

    if (options.recycle?.maxMemory && handle.memory && handle.memory >= options.recycle.maxMemory) {
      this.#restartOne(id)
    }
  }

  restart(id?: string): void {
    if (id) {
      this.#restartOne(id)
    } else {
      for (const [wid] of this.#workers) {
        this.#restartOne(wid)
      }
    }
  }

  #restartOne(id: string): void {
    const handle = this.#workers.get(id)
    const options = this.#options.get(id)
    if (!handle || !options) return

    const proc = this.#workerProcesses.get(id)
    if (proc) {
      proc.kill()
      this.#workerProcesses.delete(id)
    }

    this.#stopHealthcheck(id)
    handle.status = "spawning"
    handle.healthStatus = "unknown"
    handle.restarts++
    this.#requestCounts.set(id, 0)
    this.#startWorker(id, handle.path, options).catch(() => {})
  }

  stop(id?: string): void {
    if (id) {
      this.#stopOne(id)
    } else {
      for (const [wid] of this.#workers) {
        this.#stopOne(wid)
      }
    }
  }

  #stopOne(id: string): void {
    const handle = this.#workers.get(id)
    if (!handle) return

    const proc = this.#workerProcesses.get(id)
    if (proc) {
      proc.kill()
      this.#workerProcesses.delete(id)
    }

    this.#stopHealthcheck(id)
    handle.status = "stopped"
    handle.healthStatus = "unknown"
  }

  clear(): void {
    for (const [id] of this.#healthTimers) {
      this.#stopHealthcheck(id)
    }
    for (const [, proc] of this.#workerProcesses) {
      proc.kill()
    }
    this.#workerProcesses.clear()
    this.#workers.clear()
    this.#options.clear()
    this.#requestCounts.clear()
  }
}