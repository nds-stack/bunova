import type { RouteDefinition, RouteRegistryStats } from "../types.ts"
import { MessageStream } from "../ipc/message-stream.ts"

interface RouteWorker {
  key: string
  proc: Bun.Subprocess
  port: number
  status: "spawning" | "running" | "stopped" | "crashed"
  definitions: RouteDefinition[]
}

let nextPort = 3100

export class RouteRegistry {
  #workers = new Map<string, RouteWorker>()   // key→worker (key = pattern or group name)
  #patternToKey = new Map<string, string>()   // pattern → which worker key
  #entryPath: string

  constructor() {
    this.#entryPath = `${import.meta.dir}/route-worker-entry.ts`
  }

  get list(): RouteDefinition[] {
    const all: RouteDefinition[] = []
    for (const w of this.#workers.values()) all.push(...w.definitions)
    return all
  }

  get stats(): RouteRegistryStats {
    let running = 0
    for (const w of this.#workers.values()) {
      if (w.status === "running") running++
    }
    return {
      total: this.#workers.size,
      running,
      patterns: Array.from(this.#patternToKey.keys()),
    }
  }

  /** Register a single route (spawns its own worker) */
  async register(definition: RouteDefinition): Promise<void> {
    if (this.#patternToKey.has(definition.pattern)) {
      throw new Error(`Route pattern "${definition.pattern}" already registered`)
    }
    await this.#spawnWorker(definition.pattern, [definition])
  }

  /** Register a group of routes under one worker */
  async registerGroup(groupKey: string, definitions: RouteDefinition[]): Promise<void> {
    if (this.#workers.has(groupKey)) {
      throw new Error(`Route group "${groupKey}" already registered`)
    }
    if (definitions.length === 0) return
    // Use the first pattern as the key
    await this.#spawnWorker(groupKey, definitions)
  }

  async #spawnWorker(key: string, definitions: RouteDefinition[]): Promise<void> {
    const port = definitions[0]!.port ?? nextPort++
    const isGroup = definitions.length > 1
    const env: Record<string, string> = {
      BUNOVA_ROUTE_PORT: String(port),
    }

    if (isGroup) {
      env.BUNOVA_ROUTE_GROUP = JSON.stringify(definitions.map(d => ({ path: d.path, pattern: d.pattern })))
    } else {
      env.BUNOVA_ROUTE_PATH = definitions[0]!.path
      env.BUNOVA_ROUTE_PATTERN = definitions[0]!.pattern
    }

    const proc = Bun.spawn([process.execPath, "run", this.#entryPath], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    })

    const worker: RouteWorker = { key, proc, port, status: "spawning", definitions }
    this.#workers.set(key, worker)
    for (const d of definitions) {
      this.#patternToKey.set(d.pattern, key)
    }

    const stream = new MessageStream()
    const reader = proc.stdout.getReader() as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>

    try {
      while (true) {
        const msg = await stream.readMessageFrom(reader)
        if (msg === null) break
        const m = msg as Record<string, unknown>
        if (m.type === "ready") {
          worker.status = "running"
        } else if (m.type === "error") {
          worker.status = "crashed"
        }
        if (worker.status === "running" || worker.status === "crashed") break
      }
    } catch {
      worker.status = "crashed"
    } finally {
      reader.releaseLock()
    }

    if (worker.status === "spawning") worker.status = "crashed"
  }

  unregister(pattern: string): void {
    const key = this.#patternToKey.get(pattern)
    if (!key) return
    const worker = this.#workers.get(key)
    if (!worker) return

    // If group, remove only this pattern from the group
    if (worker.definitions.length > 1) {
      worker.definitions = worker.definitions.filter(d => d.pattern !== pattern)
      this.#patternToKey.delete(pattern)
      if (worker.definitions.length === 0) {
        worker.proc.kill()
        this.#workers.delete(key)
      }
      return
    }

    // Single route — kill worker
    worker.proc.kill()
    this.#workers.delete(key)
    this.#patternToKey.delete(pattern)
  }

  clear(): void {
    for (const [, worker] of this.#workers) worker.proc.kill()
    this.#workers.clear()
    this.#patternToKey.clear()
  }

  restart(pattern: string): void {
    const key = this.#patternToKey.get(pattern)
    if (!key) return
    const worker = this.#workers.get(key)
    if (!worker) return
    worker.proc.kill()
    this.#workers.delete(key)
    for (const d of worker.definitions) this.#patternToKey.delete(d.pattern)
  }
}
