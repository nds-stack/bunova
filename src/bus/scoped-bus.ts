import type { MessageBus } from "./message-bus.ts"

type ScopedHandler = (payload: unknown, channel: string) => void

export class ScopedBus {
  #bus: MessageBus
  #prefix: string
  #subscriptions = new Map<ScopedHandler, () => void>()

  constructor(bus: MessageBus, prefix: string) {
    this.#bus = bus
    this.#prefix = prefix
  }

  on(event: string, handler: ScopedHandler): () => void {
    const channel = `${this.#prefix}:${event}`
    const unsub = this.#bus.subscribe(channel, handler)
    this.#subscriptions.set(handler, unsub)
    return () => {
      unsub()
      this.#subscriptions.delete(handler)
    }
  }

  off(event: string, handler: ScopedHandler): void {
    const unsub = this.#subscriptions.get(handler)
    if (unsub) {
      unsub()
      this.#subscriptions.delete(handler)
    }
  }

  emit(event: string, payload?: unknown): void {
    this.#bus.publish(`${this.#prefix}:${event}`, payload)
  }

  unsubscribeAll(): void {
    for (const [, unsub] of this.#subscriptions) unsub()
    this.#subscriptions.clear()
  }
}
