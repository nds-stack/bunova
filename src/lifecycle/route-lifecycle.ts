import { ScopedBus } from "../bus/scoped-bus.ts"
import type { MessageBus } from "../bus/message-bus.ts"

export type RouteEvent = "registered" | "unregistered" | "failed"

export class RouteLifecycle {
  #bus: ScopedBus

  constructor(parent: MessageBus) {
    this.#bus = new ScopedBus(parent, "lifecycle:route")
  }

  on(event: RouteEvent, handler: (payload?: unknown) => void): () => void {
    return this.#bus.on(event, handler)
  }

  off(event: RouteEvent, handler: (payload?: unknown) => void): void {
    this.#bus.off(event, handler)
  }

  emit(event: RouteEvent, payload?: unknown): void {
    this.#bus.emit(event, payload)
  }
}
