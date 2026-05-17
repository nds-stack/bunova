import { describe, expect, test } from "bun:test"
import { MemoryWatchdog } from "../src/monitoring/memory-watchdog.ts"
import { Tracer } from "../src/monitoring/tracer.ts"
import { BunServeMonitor } from "../src/monitoring/bun-monitor.ts"

describe("MemoryWatchdog", () => {
  test("start/stop", () => {
    const wd = new MemoryWatchdog({ threshold: 1024 * 1024 * 1024, interval: 1000 })
    expect(wd.stats.active).toBe(false)
    wd.start()
    expect(wd.stats.active).toBe(true)
    wd.stop()
    expect(wd.stats.active).toBe(false)
  })
})

describe("Tracer", () => {
  test("start creates span", () => {
    const t = new Tracer()
    const id = t.start("op")
    expect(id).toBeTruthy()
    expect(t.stats.activeSpans).toBe(1)
  })

  test("end completes span", () => {
    const t = new Tracer()
    const id = t.start("op")
    const span = t.end(id)
    expect(span).not.toBeNull()
    expect(span?.duration).toBeGreaterThanOrEqual(0)
    expect(t.stats.activeSpans).toBe(0)
  })

  test("end with unknown id returns null", () => {
    const t = new Tracer()
    expect(t.end("nonexistent")).toBeNull()
  })

  test("parent-child relationship", () => {
    const t = new Tracer()
    const parentId = t.start("parent")
    const childId = t.start("child", parentId, { key: "val" })
    const child = t.end(childId)
    t.end(parentId)
    expect(child?.parentId).toBe(parentId)
  })

  test("clear resets all", () => {
    const t = new Tracer()
    t.start("a")
    t.start("b")
    expect(t.stats.activeSpans).toBe(2)
    t.clear()
    expect(t.stats.activeSpans).toBe(0)
  })
})

describe("BunServeMonitor", () => {
  test("initial metrics are zero", () => {
    const m = new BunServeMonitor()
    const metrics = m.metrics
    expect(metrics.activeRequests).toBe(0)
    expect(metrics.totalRequests).toBe(0)
    expect(metrics.totalDurationMs).toBe(0)
    expect(metrics.avgDurationMs).toBe(0)
  })

  test("wrapFetch tracks requests", async () => {
    const m = new BunServeMonitor()
    const wrapped = m.wrapFetch(async () => new Response("ok", { status: 200 }))
    await wrapped(new Request("http://test.com"))
    const metrics = m.metrics
    expect(metrics.totalRequests).toBe(1)
    expect(metrics.activeRequests).toBe(0)
    expect(metrics.statusCounts[200]).toBe(1)
  })

  test("wrapFetch tracks 500 on error", async () => {
    const m = new BunServeMonitor()
    const wrapped = m.wrapFetch(async () => { throw new Error("fail") })
    try { await wrapped(new Request("http://test.com")) } catch { /* expected */ }
    const metrics = m.metrics
    expect(metrics.totalRequests).toBe(1)
    expect(metrics.statusCounts[500]).toBe(1)
  })

  test("reset clears all", async () => {
    const m = new BunServeMonitor()
    const wrapped = m.wrapFetch(async () => new Response("ok"))
    await wrapped(new Request("http://test.com"))
    m.reset()
    expect(m.metrics.totalRequests).toBe(0)
  })
})
