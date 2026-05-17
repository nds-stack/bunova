import type { BusTransport, MessageHandler } from "./transport.ts"
import { InProcessTransport } from "./in-process-transport.ts"
import type { MessageBusStats } from "../types.ts"

export class MessageBus {
  #transport: BusTransport
  #messagesSent = 0
  #onError: ((channel: string, error: Error) => void) | null = null

  constructor(transport?: BusTransport) {
    this.#transport = transport ?? new InProcessTransport()
  }

  setTransport(transport: BusTransport): void {
    this.#transport = transport
  }

  onError(handler: ((channel: string, error: Error) => void) | null): void {
    this.#onError = handler
  }

  get stats(): MessageBusStats {
    return {
      channels: this.#transport.channelCount,
      subscribers: this.#transport.subscriberCount,
      messagesSent: this.#messagesSent,
    }
  }

  publish(channel: string, payload?: unknown): void {
    this.#messagesSent++
    this.#transport.publish(channel, payload)
  }

  publishAsync(channel: string, payload?: unknown): void {
    this.#messagesSent++
    // Schedule handler execution as microtasks to avoid blocking
    // the caller when handlers are slow
    queueMicrotask(() => {
      this.#transport.publish(channel, payload)
    })
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    const wrapped: MessageHandler = (payload, ch) => {
      try {
        handler(payload, ch)
      } catch (err) {
        this.#onError?.(ch, err instanceof Error ? err : new Error(String(err)))
      }
    }
    return this.#transport.subscribe(channel, wrapped)
  }

  unsubscribeAll(): void {
    this.#transport.unsubscribeAll()
  }
}
