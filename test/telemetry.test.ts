import { describe, expect, test } from "bun:test"
import { TelemetryEngine } from "../src/telemetry/engine.ts"

describe("TelemetryEngine", () => {
  test("snapshot returns memory, cpu, and event loop data", () => {
    const te = new TelemetryEngine()
    const snap = te.snapshot()
    expect(snap.memory).toBeDefined()
    expect(snap.memory.heapUsed).toBeGreaterThan(0)
    expect(snap.memory.heapTotal).toBeGreaterThan(0)
    expect(snap.memory.rss).toBeGreaterThan(0)
    expect(snap.cpu).toBeDefined()
    expect(typeof snap.cpu?.user).toBe("number")
    expect(typeof snap.cpu?.system).toBe("number")
    expect(snap.eventLoop).toBeDefined()
    expect(typeof snap.eventLoop.lag).toBe("number")
  })

  test("memory() returns current usage", () => {
    const te = new TelemetryEngine()
    const mem = te.memory()
    expect(mem.heapUsed).toBeGreaterThan(0)
    expect(mem.heapTotal).toBeGreaterThan(0)
  })

  test("cpu() returns CPU usage", () => {
    const te = new TelemetryEngine()
    const cpu = te.cpu()
    expect(typeof cpu.user).toBe("number")
    expect(typeof cpu.system).toBe("number")
  })

  test("eventLoop() returns lag", () => {
    const te = new TelemetryEngine()
    const el = te.eventLoop()
    expect(typeof el.lag).toBe("number")
  })

  test("start/stop collection", () => {
    const te = new TelemetryEngine({ interval: 100 })
    expect(te.started).toBe(false)
    te.start()
    expect(te.started).toBe(true)
    te.stop()
    expect(te.started).toBe(false)
  })

  test("history accumulates via snapshot", () => {
    const te = new TelemetryEngine({ interval: 50 })
    expect(te.history).toHaveLength(0)
    te.snapshot()
    te.snapshot()
    expect(te.history).toHaveLength(2)
  })

  test("history limited by maxHistory", () => {
    const te = new TelemetryEngine({ interval: 10, history: 3 })
    for (let i = 0; i < 10; i++) {
      te.snapshot()
    }
    expect(te.history.length).toBeLessThanOrEqual(3)
  })

  test("disable memory and cpu", () => {
    const te = new TelemetryEngine({ memory: false, cpu: false })
    const snap = te.snapshot()
    expect(snap.memory.heapUsed).toBe(0)
    expect(snap.cpu).toBeUndefined()
  })
})
