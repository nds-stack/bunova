import type { Plugin, PluginContext } from "../types.ts"
import { MessageStream, writeStdout } from "../ipc/message-stream.ts"

interface PluginMessage {
  type: "install" | "uninstall" | "event"
  name: string
  path?: string
  version?: string
  channel?: string
  payload?: unknown
}

let plugin: Plugin | null = null

async function handleInstall(msg: PluginMessage): Promise<void> {
  try {
      if (msg.path) {
      // Security: reject path traversal (cross-platform)
      if (msg.path.includes("..") || /^[/\\]|[a-zA-Z]:[/\\]/.test(msg.path)) {
        writeStdout({ type: "error", name: msg.name, message: "Invalid plugin path" })
        process.exit(1)
        return
      }
      const mod = await import(msg.path)
      plugin = (mod.default ?? mod) as Plugin
      const ctx: PluginContext = {
        logger: undefined,
        on: () => {},
        broadcast: (channel, payload) => {
          writeStdout({ type: "broadcast", name: msg.name, channel, payload })
        },
      }
      if (plugin.install) {
        await plugin.install(ctx)
      }
    }
    writeStdout({ type: "installed", name: msg.name })
  } catch (err) {
    writeStdout({ type: "error", name: msg.name, message: String(err) })
    process.exit(1)
  }
}

async function handleUninstall(msg: PluginMessage): Promise<void> {
  try {
    if (plugin?.uninstall) {
      await plugin.uninstall({ logger: undefined, on: () => {}, broadcast: () => {} })
    }
  } catch { /* ignore */ }
  writeStdout({ type: "uninstalled", name: msg.name })
  process.exit(0)
}

async function handleEvent(msg: PluginMessage): Promise<void> {
  writeStdout({ type: "broadcast", name: msg.name, channel: `${msg.name}:event`, payload: msg.payload })
}

async function main(): Promise<void> {
  const payload = process.env.BUNOVA_PLUGIN_PAYLOAD
  if (!payload) {
    writeStdout({ type: "error", name: "unknown", message: "Missing BUNOVA_PLUGIN_PAYLOAD" })
    process.exit(1)
    return
  }

  let msg: PluginMessage
  try {
    msg = JSON.parse(payload) as PluginMessage
  } catch {
    writeStdout({ type: "error", name: "unknown", message: "Invalid plugin payload JSON" })
    process.exit(1)
    return
  }

  if (msg.type === "install") {
    await handleInstall(msg)
    if (process.env.BUNOVA_TESTING) {
      process.exit(0)
      return
    }
  }

  if (msg.type === "uninstall") {
    await handleUninstall(msg)
    return
  }

  // Stay alive for IPC — read stdin with MessageStream
  const stream = new MessageStream()
  const reader = Bun.stdin.stream().getReader() as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>

  try {
    while (true) {
      const result = await stream.readMessageFrom(reader)
      if (result === null) break
      const cmd = result as PluginMessage
      if (cmd.type === "event") {
        await handleEvent(cmd)
      } else if (cmd.type === "uninstall") {
        await handleUninstall(cmd)
        return
      }
    }
  } catch {
    // stdin error
  }

  process.exit(0)
}

main()
