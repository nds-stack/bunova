export type MessageHandler = (payload: unknown, channel: string) => void

export interface BusTransport {
  subscribe(channel: string, handler: MessageHandler): () => void
  publish(channel: string, payload?: unknown): void
  unsubscribeAll(): void
  readonly subscriberCount: number
  readonly channelCount: number
}
