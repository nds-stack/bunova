import type { ReloadOptions, ReloadStats } from "../types.ts"

export class ReloadEngine {
  #reloadCount = 0
  #lastReload: string | null = null
  #watchEnabled = false
  #callbacks: Array<() => void | Promise<void>> = []

  get stats(): ReloadStats {
    return {
      lastReload: this.#lastReload,
      reloadCount: this.#reloadCount,
      watchEnabled: this.#watchEnabled,
      watchedFiles: 0,
    }
  }

  onReload(cb: () => void | Promise<void>): void {
    this.#callbacks.push(cb)
  }

  async reload(_options: ReloadOptions = {}): Promise<void> {
    this.#reloadCount++
    this.#lastReload = new Date().toISOString()

    for (const cb of this.#callbacks) {
      try {
        await cb()
      } catch {
        // individual reload callback error — don't block others
      }
    }
  }

  watch(): void {
    if (this.#watchEnabled) return
    this.#watchEnabled = true
  }

  unwatch(): void {
    this.#watchEnabled = false
  }
}
