import { describe, expect, test, mock } from "bun:test"
import { ScopedBus } from "../src/bus/scoped-bus.ts"
import { MessageBus } from "../src/bus/message-bus.ts"

describe("ScopedBus", () => {
  test("on subscribes with prefix", () => {
    const bus = new MessageBus()
    const scoped = new ScopedBus(bus, "worker")
    const handler = mock(() => {})
    scoped.on("spawned", handler)
    bus.publish("worker:spawned", { id: "1" })
    expect(handler).toHaveBeenCalledWith({ id: "1" }, "worker:spawned")
  })

  test("off removes handler", () => {
    const bus = new MessageBus()
    const scoped = new ScopedBus(bus, "plugin")
    const handler = mock(() => {})
    scoped.on("error", handler)
    scoped.off("error", handler)
    bus.publish("plugin:error", "fail")
    expect(handler).not.toHaveBeenCalled()
  })

  test("unsubscribe returned from on() removes handler", () => {
    const bus = new MessageBus()
    const scoped = new ScopedBus(bus, "route")
    const handler = mock(() => {})
    const unsub = scoped.on("registered", handler)
    unsub()
    bus.publish("route:registered", "/api")
    expect(handler).not.toHaveBeenCalled()
  })

  test("different prefixes isolated", () => {
    const bus = new MessageBus()
    const w = new ScopedBus(bus, "worker")
    const p = new ScopedBus(bus, "plugin")
    const h = mock(() => {})
    w.on("spawned", h)
    p.on("spawned", h)
    bus.publish("worker:spawned", "w1")
    expect(h).toHaveBeenCalledTimes(1)
  })

  test("unsubscribeAll clears all", () => {
    const bus = new MessageBus()
    const scoped = new ScopedBus(bus, "worker")
    scoped.on("a", mock(() => {}))
    scoped.on("b", mock(() => {}))
    scoped.unsubscribeAll()
    expect(bus.stats.subscribers).toBe(0)
  })
})
