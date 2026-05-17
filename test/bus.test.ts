import { describe, expect, test, mock } from "bun:test"
import { MessageBus } from "../src/bus/message-bus.ts"

describe("MessageBus", () => {
  test("publish sends to subscribers", () => {
    const bus = new MessageBus()
    const handler = mock(() => {})
    bus.subscribe("test", handler)
    bus.publish("test", "hello")
    expect(handler).toHaveBeenCalledWith("hello", "test")
  })

  test("unsubscribe removes handler", () => {
    const bus = new MessageBus()
    const handler = mock(() => {})
    const unsub = bus.subscribe("test", handler)
    unsub()
    bus.publish("test", "data")
    expect(handler).not.toHaveBeenCalled()
  })

  test("multiple handlers on same channel", () => {
    const bus = new MessageBus()
    const a = mock(() => {})
    const b = mock(() => {})
    bus.subscribe("ch", a)
    bus.subscribe("ch", b)
    bus.publish("ch", "msg")
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  test("different channels isolated", () => {
    const bus = new MessageBus()
    const h = mock(() => {})
    bus.subscribe("ch1", h)
    bus.publish("ch2", "data")
    expect(h).not.toHaveBeenCalled()
  })

  test("unsubscribeAll clears all", () => {
    const bus = new MessageBus()
    bus.subscribe("ch1", () => {})
    bus.subscribe("ch2", () => {})
    bus.unsubscribeAll()
    expect(bus.stats.channels).toBe(0)
  })

  test("stats correct", () => {
    const bus = new MessageBus()
    bus.subscribe("ch1", () => {})
    bus.subscribe("ch1", () => {})
    bus.subscribe("ch2", () => {})
    expect(bus.stats.channels).toBe(2)
    expect(bus.stats.subscribers).toBe(3)
    bus.publish("ch1", "msg")
    expect(bus.stats.messagesSent).toBe(1)
  })

  test("handler errors isolated", () => {
    const bus = new MessageBus()
    const bad = mock(() => { throw new Error("bad") })
    const good = mock(() => {})
    bus.subscribe("ch", bad)
    bus.subscribe("ch", good)
    bus.publish("ch", "data")
    expect(good).toHaveBeenCalled()
  })

  test("publishAsync does not block", async () => {
    const bus = new MessageBus()
    let flag = false
    bus.subscribe("slow", async () => {
      await Bun.sleep(50)
      flag = true
    })
    bus.publishAsync("slow", "data")
    // publishAsync returns immediately — flag should still be false
    expect(flag).toBe(false)
    // Wait for the microtask to complete
    await Bun.sleep(100)
    expect(flag).toBe(true)
  })
})
