import { watch } from "fs"
import type { ReloadStats } from "../types.ts"

type ReloadCallback = (event: { type: string; path: string }) => void | Promise<void>

export class FileWatcher {
  #watchEnabled = false
  #reloadCount = 0
  #lastReload: string | null = null
  #watchedFiles = 0
  #callbacks: ReloadCallback[] = []
  #watchers: ReturnType<typeof watch>[] = []

  get stats(): ReloadStats {
    return {
      lastReload: this.#lastReload,
      reloadCount: this.#reloadCount,
      watchEnabled: this.#watchEnabled,
      watchedFiles: this.#watchedFiles,
    }
  }

  onReload(cb: ReloadCallback): void {
    this.#callbacks.push(cb)
  }

  watch(dirs: string[] = ["src"]): void {
    if (this.#watchEnabled) return
    this.#watchEnabled = true

    for (const dir of dirs) {
      this.#watchDir(dir)
    }
  }

  #watchDir(dir: string): void {
    try {
      const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        this.#reloadCount++
        this.#lastReload = new Date().toISOString()
        this.#watchedFiles++
        for (const cb of this.#callbacks) {
          cb({ type: eventType ?? "change", path: filename.toString() })
        }
      })
      this.#watchers.push(watcher)
    } catch (err) {
      console.warn(`[Bunova] Cannot watch directory "${dir}":`, err)
    }
  }

  unwatch(): void {
    for (const w of this.#watchers) {
      w.close()
    }
    this.#watchers = []
    this.#watchEnabled = false
  }
}
