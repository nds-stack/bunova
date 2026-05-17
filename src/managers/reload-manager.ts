import type { ReloadOptions, ReloadStats } from "../types.ts"
import { ReloadEngine } from "../reload/engine.ts"
import { FileWatcher } from "../reload/watcher.ts"
import type { BunLogger } from "@nds-stack/bun-logger"

type OnFileChange = (event: { type: string; path: string }) => void | Promise<void>

export class ReloadManager {
  readonly engine = new ReloadEngine()
  readonly watcher = new FileWatcher()
  logger: BunLogger | undefined

  setLogger(logger: BunLogger | undefined): void {
    this.logger = logger
  }

  onReload(cb: () => void | Promise<void>): void {
    this.engine.onReload(cb)
  }

  onFileChange(cb: OnFileChange): void {
    this.watcher.onReload(cb)
  }

  reload(options?: ReloadOptions): void {
    this.engine.reload(options)
  }

  watch(dirs: string[] = ["src"]): void {
    this.watcher.watch(dirs)
  }

  unwatch(): void {
    this.watcher.unwatch()
  }

  get stats(): ReloadStats {
    return this.watcher.stats
  }
}
