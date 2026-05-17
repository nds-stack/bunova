import type { TelemetryOptions, TelemetrySnapshot } from "../types.ts"

export class TelemetryEngine {
  #interval: number
  #memoryEnabled: boolean
  #eventLoopEnabled: boolean
  #cpuEnabled: boolean
  #maxHistory: number
  #buffer: TelemetrySnapshot[]
  #head = 0
  #count = 0
  #timer: Timer | null = null
  #startedAt: string | null = null
  #lastEventLoopLag = 0

  constructor(options: TelemetryOptions = {}) {
    this.#interval = options.interval ?? 5000
    this.#memoryEnabled = options.memory ?? true
    this.#eventLoopEnabled = options.eventLoop ?? true
    this.#cpuEnabled = options.cpu ?? true
    this.#maxHistory = options.history ?? 100
    this.#buffer = new Array(this.#maxHistory)
  }

  get started(): boolean {
    return this.#timer !== null
  }

  get history(): TelemetrySnapshot[] {
    // Return in insertion order (oldest first)
    const result: TelemetrySnapshot[] = []
    const count = Math.min(this.#count, this.#maxHistory)
    for (let i = 0; i < count; i++) {
      const idx = (this.#head + i) % this.#maxHistory
      result.push(this.#buffer[idx]!)
    }
    return result
  }

  start(): void {
    if (this.#timer) return
    this.#startedAt = new Date().toISOString()
    this.#timer = setInterval(async () => {
      this.#lastEventLoopLag = await this.#measureEventLoop()
      this.#pushSnapshot()
    }, this.#interval)
  }

  stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
  }

  snapshot(): TelemetrySnapshot {
    return this.#pushSnapshot()
  }

  #pushSnapshot(): TelemetrySnapshot {
    const snap: TelemetrySnapshot = {
      memory: this.#memoryEnabled ? this.#collectMemory() : { heapUsed: 0, heapTotal: 0, rss: 0, external: 0, arrayBuffers: 0 },
      eventLoop: this.#eventLoopEnabled ? { lag: this.#lastEventLoopLag } : { lag: 0 },
      cpu: this.#cpuEnabled ? this.#collectCpu() : undefined,
      uptime: this.#startedAt ? Date.now() - new Date(this.#startedAt).getTime() : 0,
      timestamp: new Date().toISOString(),
    }
    // Ring buffer write: O(1), no shift()
    this.#buffer[this.#head] = snap
    this.#head = (this.#head + 1) % this.#maxHistory
    if (this.#count < this.#maxHistory) this.#count++
    return snap
  }

  memory(): { heapUsed: number; heapTotal: number; rss: number; external: number; arrayBuffers: number } {
    return this.#collectMemory()
  }

  eventLoop(): { lag: number } {
    return { lag: this.#lastEventLoopLag }
  }

  cpu(): { user: number; system: number } {
    return this.#collectCpu()
  }

  #collectMemory() {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers ?? 0,
    }
  }

  #measureEventLoop(): Promise<number> {
    const start = performance.now()
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(performance.now() - start)
      }, 0)
    })
  }

  #collectCpu(): { user: number; system: number } {
    const usage = process.cpuUsage()
    return {
      user: usage.user,
      system: usage.system,
    }
  }
}
