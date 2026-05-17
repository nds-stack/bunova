import { ScopedBus } from "../bus/scoped-bus.ts"
import type { MessageBus } from "../bus/message-bus.ts"

export type PluginEvent = "installed" | "uninstalled" | "error" | "crashed" | "isolated"

export class PluginLifecycle {
  #bus: ScopedBus

  constructor(parent: MessageBus) {
    this.#bus = new ScopedBus(parent, "lifecycle:plugin")
  }

  on(event: PluginEvent, handler: (payload?: unknown) => void): () => void {
    return this.#bus.on(event, handler)
  }

  off(event: PluginEvent, handler: (payload?: unknown) => void): void {
    this.#bus.off(event, handler)
  }

  emit(event: PluginEvent, payload?: unknown): void {
    this.#bus.emit(event, payload)
  }
}
