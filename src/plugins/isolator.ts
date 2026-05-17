import type { Plugin, PluginContext } from "../types.ts"
import { MessageStream, writeFrame } from "../ipc/message-stream.ts"

interface WorkerEntry {
  type: "in-process" | "worker"
  proc?: Bun.Subprocess
  stdin?: Exclude<Bun.Subprocess["stdin"], number>
}

export class PluginIsolator {
  #isolated = new Map<string, WorkerEntry>()

  isIsolated(name: string): boolean {
    return this.#isolated.has(name)
  }

  async runIsolated(plugin: Plugin, ctx: PluginContext): Promise<void> {
    this.#isolated.set(plugin.name, { type: "in-process" })

    if (plugin.install) {
      await plugin.install(ctx)
    }

    ctx.broadcast("plugin:isolated", { plugin: plugin.name, event: "installed" })
  }

  async spawnWorker(pluginPath: string, ctx: PluginContext): Promise<void> {
    // Sanitize: prevent path traversal
    if (pluginPath.includes("..")) {
      throw new Error("Path traversal detected in plugin path")
    }

    const name = pluginPath.split("/").pop()?.replace(/\.(ts|js)$/, "") ?? "unknown"

    const entryPath = `${import.meta.dir}/plugin-worker-entry.ts`

    const installMsg = JSON.stringify({
      type: "install",
      name,
      path: pluginPath,
    })

    const proc = Bun.spawn([process.execPath, "run", entryPath], {
      env: {
        ...process.env,
        BUNOVA_PLUGIN_PAYLOAD: installMsg,
      },
      stdio: ["pipe", "pipe", "pipe"],
    })

    const stdin = proc.stdin
    const entry: WorkerEntry = { type: "worker", proc, stdin }
    this.#isolated.set(name, entry)

    const stream = new MessageStream()
    const reader = proc.stdout.getReader() as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>
    let installed = false

    try {
      while (true) {
        const msg = await stream.readMessageFrom(reader)
        if (msg === null) break

        const m = msg as Record<string, unknown>

        // Validate IPC message structure
        if (!m || typeof m !== "object" || Array.isArray(m)) continue
        if (typeof m.type !== "string") continue

        if (m.type === "installed") {
          installed = true
          ctx.broadcast("plugin:isolated", { plugin: name, event: "installed" })
          break
        } else if (m.type === "broadcast" && typeof m.channel === "string") {
          ctx.broadcast(m.channel, m.payload)
        } else if (m.type === "error") {
          ctx.broadcast("plugin:error", { plugin: name, error: typeof m.message === "string" ? m.message : String(m.message) })
        }
        // Unknown message types silently dropped — prevents
        // malformed or malicious payloads from affecting the runtime
      }
    } catch {
      // stream error
    } finally {
      reader.cancel().catch(() => {})
      reader.releaseLock()
    }

    if (!installed) {
      this.#isolated.delete(name)
      const exitCode = await proc.exited
      if (exitCode !== 0 && exitCode !== null) {
        ctx.broadcast("plugin:crashed", { plugin: name, exitCode })
      }
    }
  }

  async send(name: string, channel: string, payload?: unknown): Promise<void> {
    const entry = this.#isolated.get(name)
    if (!entry || entry.type !== "worker" || !entry.stdin) return
    writeFrame(entry.stdin, { type: "event", name, channel, payload })
  }

  async terminate(name: string): Promise<void> {
    const entry = this.#isolated.get(name)
    if (!entry) return

    if (entry.type === "worker" && entry.proc && entry.stdin) {
      writeFrame(entry.stdin, { type: "uninstall", name })
    }

    this.#isolated.delete(name)
  }

  terminateAll(): void {
    for (const [, entry] of this.#isolated) {
      if (entry.type === "worker" && entry.proc) {
        try { entry.proc.kill() } catch { /* ignore */ }
      }
    }
    this.#isolated.clear()
  }
}
