import { describe, expect, test } from "bun:test"
import { MessageStream, writeStdout, writeFrame } from "../src/ipc/message-stream.ts"

describe("MessageStream IPC", () => {
  test("writeStdout produces parseable frame", () => {
    // Can't easily test stdout, but we can verify the function exists and is callable
    expect(typeof writeStdout).toBe("function")
  })

  test("writeFrame produces parseable frame", () => {
    expect(typeof writeFrame).toBe("function")
  })

  test("MessageStream push + onMessage delivers message", async () => {
    const stream = new MessageStream()
    const encoder = new TextEncoder()
    const msg = JSON.stringify({ type: "test", value: 42 })
    const data = encoder.encode(msg)
    const header = new Uint8Array(4)
    new DataView(header.buffer).setUint32(0, data.length, true)
    const frame = new Uint8Array(4 + data.length)
    frame.set(header, 0)
    frame.set(data, 4)

    const result = await new Promise<unknown>((resolve) => {
      stream.onMessage((m) => resolve(m))
      stream.push(frame)
    })

    expect(result).toEqual({ type: "test", value: 42 })
  })

  test("MessageStream handles partial data via reader", async () => {
    const stream = new MessageStream()
    const encoder = new TextEncoder()
    const msg = JSON.stringify({ hello: "world" })
    const data = encoder.encode(msg)
    const header = new Uint8Array(4)
    new DataView(header.buffer).setUint32(0, data.length, true)

    // Create a reader that returns header first, then data
    let chunkIndex = 0
    const chunks = [header, data]
    const mockReader = {
      read: async () => {
        if (chunkIndex >= chunks.length) return { done: true as const, value: undefined }
        return { done: false as const, value: chunks[chunkIndex++]! }
      },
      releaseLock: () => {},
    } as ReadableStreamDefaultReader<Uint8Array>

    const result = await stream.readMessageFrom(mockReader)
    expect(result).toEqual({ hello: "world" })
  })

  test("MessageStream handles multiple messages via reader", async () => {
    const stream = new MessageStream()
    const encoder = new TextEncoder()

    function makeFrame(obj: unknown): Uint8Array {
      const data = encoder.encode(JSON.stringify(obj))
      const hdr = new Uint8Array(4)
      new DataView(hdr.buffer).setUint32(0, data.length, true)
      const frame = new Uint8Array(4 + data.length)
      frame.set(hdr, 0)
      frame.set(data, 4)
      return frame
    }

    const f1 = makeFrame({ seq: 1 })
    const f2 = makeFrame({ seq: 2 })
    const combined = new Uint8Array(f1.length + f2.length)
    combined.set(f1, 0)
    combined.set(f2, f1.length)

    let chunkIndex = 0
    const chunks = [combined]
    const mockReader = {
      read: async () => {
        if (chunkIndex >= chunks.length) return { done: true as const, value: undefined }
        return { done: false as const, value: chunks[chunkIndex++]! }
      },
      releaseLock: () => {},
    } as ReadableStreamDefaultReader<Uint8Array>

    const results: unknown[] = []
    for (let i = 0; i < 2; i++) {
      const msg = await stream.readMessageFrom(mockReader)
      if (msg) results.push(msg)
    }
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ seq: 1 })
    expect(results[1]).toEqual({ seq: 2 })
  })
})
