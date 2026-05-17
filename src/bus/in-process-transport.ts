import type { BusTransport, MessageHandler } from "./transport.ts"

export class InProcessTransport implements BusTransport {
  #subscribers = new Map<string, Set<MessageHandler>>()

  get subscriberCount(): number {
    let count = 0
    for (const handlers of this.#subscribers.values()) {
      count += handlers.size
    }
    return count
  }

  get channelCount(): number {
    return this.#subscribers.size
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    let handlers = this.#subscribers.get(channel)
    if (!handlers) {
      handlers = new Set()
      this.#subscribers.set(channel, handlers)
    }
    handlers.add(handler)
    return () => {
      handlers?.delete(handler)
      if (handlers?.size === 0) {
        this.#subscribers.delete(channel)
      }
    }
  }

  publish(channel: string, payload?: unknown): void {
    const handlers = this.#subscribers.get(channel)
    if (!handlers) return
    // Iterate over a copy to avoid issues if handlers mutate during iteration
    for (const handler of [...handlers]) {
      handler(payload, channel)
    }
  }

  unsubscribeAll(): void {
    this.#subscribers.clear()
  }
}
