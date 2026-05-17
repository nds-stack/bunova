import { ScopedBus } from "../bus/scoped-bus.ts"
import type { MessageBus } from "../bus/message-bus.ts"

export type WorkerEvent = "spawned" | "crashed" | "restarted" | "stopped"

export class WorkerLifecycle {
  #bus: ScopedBus

  constructor(parent: MessageBus) {
    this.#bus = new ScopedBus(parent, "lifecycle:worker")
  }

  on(event: WorkerEvent, handler: (payload?: unknown) => void): () => void {
    return this.#bus.on(event, handler)
  }

  off(event: WorkerEvent, handler: (payload?: unknown) => void): void {
    this.#bus.off(event, handler)
  }

  emit(event: WorkerEvent, payload?: unknown): void {
    this.#bus.emit(event, payload)
  }
}
