import type { Plugin, PluginHandle, PluginContext, PluginUseOptions } from "../types.ts"
import { PluginIsolator } from "./isolator.ts"

export class PluginManager {
  #plugins = new Map<string, PluginHandle>()
  #installed = new Map<string, Plugin>()
  #contexts = new Map<string, PluginContext>()
  #isolator = new PluginIsolator()

  get list(): PluginHandle[] {
    return Array.from(this.#plugins.values())
  }

  get count(): number {
    return this.#plugins.size
  }

  async install(target: Plugin | string, ctx: PluginContext, options: PluginUseOptions = {}): Promise<void> {
    const name = typeof target === "string"
      ? target.split("/").pop()?.replace(/\.(ts|js)$/, "") ?? "file-plugin"
      : target.name

    if (this.#plugins.has(name)) {
      throw new Error(`Plugin "${name}" already installed`)
    }

    const handle: PluginHandle = {
      name,
      version: typeof target === "string" ? "0.0.0" : (target.version ?? "0.0.0"),
      installed: false,
      installedAt: null,
      isolated: options.isolate ?? false,
    }

    this.#plugins.set(name, handle)
    this.#contexts.set(name, ctx)

    try {
      if (options.isolate && typeof target === "string") {
        await this.#isolator.spawnWorker(target, ctx)
      } else if (options.isolate && typeof target !== "string") {
        await this.#isolator.runIsolated(target as Plugin, ctx)
      } else if (typeof target !== "string") {
        const plugin = target as Plugin
        this.#installed.set(name, plugin)
        if (plugin.install) {
          await plugin.install(ctx)
        }
      }
    } catch (err) {
      this.#plugins.delete(name)
      this.#installed.delete(name)
      throw err
    }

    handle.installed = true
    handle.installedAt = new Date().toISOString()
  }

  async uninstall(name: string): Promise<void> {
    const handle = this.#plugins.get(name)
    if (!handle) {
      throw new Error(`Plugin "${name}" not installed`)
    }

    handle.installed = false

    if (handle.isolated) {
      await this.#isolator.terminate(name)
    } else {
      const plugin = this.#installed.get(name)
      const ctx = this.#contexts.get(name)
      if (plugin?.uninstall) {
        await plugin.uninstall(ctx ?? { logger: undefined, on: () => {}, broadcast: () => {} })
      }
    }

    this.#plugins.delete(name)
    this.#installed.delete(name)
    this.#contexts.delete(name)
  }

  get(name: string): Plugin | undefined {
    return this.#installed.get(name)
  }

  async send(name: string, channel: string, payload?: unknown): Promise<void> {
    await this.#isolator.send(name, channel, payload)
  }

  clear(): void {
    this.#isolator.terminateAll()
    this.#plugins.clear()
    this.#installed.clear()
    this.#contexts.clear()
  }
}
