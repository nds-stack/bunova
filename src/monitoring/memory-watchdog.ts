import type { MemoryWatchdogOptions, MemoryWatchdogStats } from "../types.ts"

export class MemoryWatchdog {
  #threshold: number
  #interval: number
  #callback: (() => void | Promise<void>) | null
  #timer: Timer | null = null
  #breaches = 0
  #lastBreach: string | null = null

  constructor(options: MemoryWatchdogOptions) {
    this.#threshold = options.threshold
    this.#interval = options.interval
    this.#callback = options.callback ?? null
  }

  get stats(): MemoryWatchdogStats {
    return {
      threshold: this.#threshold,
      currentUsage: process.memoryUsage().heapUsed,
      breaches: this.#breaches,
      lastBreach: this.#lastBreach,
      active: this.#timer !== null,
    }
  }

  start(): void {
    if (this.#timer) return
    this.#timer = setInterval(() => {
      const usage = process.memoryUsage().heapUsed
      if (usage > this.#threshold) {
        this.#breaches++
        this.#lastBreach = new Date().toISOString()
        this.#callback?.()
      }
    }, this.#interval)
  }

  stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
  }
}
