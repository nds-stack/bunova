import { describe, expect, test, mock } from "bun:test"
import { Lifecycle } from "../src/lifecycle.ts"

describe("Lifecycle — Full States", () => {
  test("starts in init state", () => {
    const lc = new Lifecycle()
    expect(lc.state).toBe("init")
  })

  test("full valid transition chain", () => {
    const lc = new Lifecycle()
    lc.transition("booting")
    expect(lc.state).toBe("booting")
    lc.transition("plugin-init")
    expect(lc.state).toBe("plugin-init")
    lc.transition("starting-server")
    expect(lc.state).toBe("starting-server")
    lc.transition("ready")
    expect(lc.state).toBe("ready")
    lc.transition("running")
    expect(lc.state).toBe("running")
    lc.transition("degraded")
    expect(lc.state).toBe("degraded")
    lc.transition("recovering")
    expect(lc.state).toBe("recovering")
    lc.transition("running")
    expect(lc.state).toBe("running")
    lc.transition("shutting-down")
    expect(lc.state).toBe("shutting-down")
  })

  test("invalid transition throws", () => {
    const lc = new Lifecycle()
    expect(() => lc.transition("ready")).toThrow("Invalid lifecycle transition")
  })

  test("cannot transition from crashed", () => {
    const lc = new Lifecycle()
    lc.transition("booting")
    lc.transition("crashed")
    expect(() => lc.transition("ready")).toThrow("Invalid lifecycle transition")
  })

  test("direct crash from many states", () => {
    const lc = new Lifecycle()
    lc.transition("booting")
    lc.transition("crashed")
    expect(lc.state).toBe("crashed")
  })

  test("shutting-down can reset to init", () => {
    const lc = new Lifecycle()
    lc.transition("booting")
    lc.transition("plugin-init")
    lc.transition("starting-server")
    lc.transition("ready")
    lc.transition("shutting-down")
    lc.transition("init")
    expect(lc.state).toBe("init")
  })

  test("on/off handlers", () => {
    const lc = new Lifecycle()
    const handler = mock(() => {})
    lc.on("running", handler)
    lc.emit("running")
    expect(handler).toHaveBeenCalled()
  })

  test("off removes handler", () => {
    const lc = new Lifecycle()
    const handler = mock(() => {})
    lc.on("running", handler)
    lc.off("running", handler)
    lc.emit("running")
    expect(handler).not.toHaveBeenCalled()
  })

  test("emit passes arguments", () => {
    const lc = new Lifecycle()
    const handler = mock(() => {})
    lc.on("degraded", handler)
    lc.emit("degraded", "high-memory")
    expect(handler).toHaveBeenCalledWith("high-memory")
  })

  test("aggregate errors from handlers", async () => {
    const lc = new Lifecycle()
    lc.on("ready", () => { throw new Error("err1") })
    lc.on("ready", () => { throw new Error("err2") })
    await expect(lc.emit("ready")).rejects.toThrow(AggregateError)
  })

  test("reset clears all", () => {
    const lc = new Lifecycle()
    lc.transition("booting")
    lc.on("ready", () => {})
    lc.reset()
    expect(lc.state).toBe("init")
  })
})
