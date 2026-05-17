const HEADER_SIZE = 4
const TIMEOUT_MS = 5000

type MessageHandler = (msg: unknown) => void

function encodeFrame(obj: unknown): Uint8Array {
  const data = new TextEncoder().encode(JSON.stringify(obj))
  const header = new Uint8Array(HEADER_SIZE)
  new DataView(header.buffer, header.byteOffset, header.byteLength).setUint32(0, data.length, true)
  const frame = new Uint8Array(HEADER_SIZE + data.length)
  frame.set(header, 0)
  frame.set(data, HEADER_SIZE)
  return frame
}

export function writeFrame(writer: { write: (data: Uint8Array) => unknown }, obj: unknown): void {
  writer.write(encodeFrame(obj))
}

export function writeStdout(obj: unknown): void {
  process.stdout.write(encodeFrame(obj))
}

export class MessageStream {
  #buffer = new Uint8Array(0)
  #onMessage: MessageHandler | null = null

  onMessage(handler: MessageHandler | null): void {
    this.#onMessage = handler
  }

  #append(chunk: Uint8Array): void {
    const combined = new Uint8Array(this.#buffer.length + chunk.length)
    combined.set(this.#buffer, 0)
    combined.set(chunk, this.#buffer.length)
    this.#buffer = combined
  }

  push(chunk: Uint8Array): void {
    this.#append(chunk)
    this.#flush()
  }

  async readMessageFrom(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>): Promise<unknown | null> {
    const msg = this.#tryExtract()
    if (msg !== undefined) return msg

    while (true) {
      const result = await Promise.race([
        reader.read(),
        Bun.sleep(TIMEOUT_MS).then(() => null),
      ])
      if (result === null) {
        reader.cancel().catch(() => {})
        reader.releaseLock()
        return null
      }
      if (result.done) return null

      this.#append(result.value)

      const extracted = this.#tryExtract()
      if (extracted !== undefined) return extracted
    }
  }

  #tryExtract(): unknown | undefined {
    if (this.#buffer.length < HEADER_SIZE) return undefined

    const length = new DataView(this.#buffer.buffer, this.#buffer.byteOffset, this.#buffer.byteLength).getUint32(0, true)
    const totalSize = HEADER_SIZE + length

    if (this.#buffer.length < totalSize) return undefined

    const msgBytes = this.#buffer.slice(HEADER_SIZE, totalSize)
    this.#buffer = this.#buffer.slice(totalSize)

    try {
      return JSON.parse(new TextDecoder().decode(msgBytes))
    } catch {
      // skip malformed frame
    }
    return undefined
  }

  #flush(): void {
    while (true) {
      const msg = this.#tryExtract()
      if (msg === undefined) break
      this.#onMessage?.(msg)
    }
  }
}
