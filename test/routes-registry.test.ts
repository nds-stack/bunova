import { describe, expect, test } from "bun:test"
import { RouteRegistry } from "../src/routes/registry.ts"

describe("RouteRegistry", () => {
  test("empty initially", () => {
    const r = new RouteRegistry()
    expect(r.list).toHaveLength(0)
    expect(r.stats.total).toBe(0)
    expect(r.stats.running).toBe(0)
    expect(r.stats.patterns).toHaveLength(0)
  })

  test("register and unregister", async () => {
    const r = new RouteRegistry()
    await r.register({ pattern: "/api/foo", path: "src/routes/foo.ts" })
    expect(r.list).toHaveLength(1)
    expect(r.list[0]!.pattern).toBe("/api/foo")

    r.unregister("/api/foo")
    expect(r.list).toHaveLength(0)
  })

  test("duplicate pattern throws", async () => {
    const r = new RouteRegistry()
    await r.register({ pattern: "/api/bar", path: "src/routes/bar.ts" })
    expect(r.register({ pattern: "/api/bar", path: "src/routes/bar2.ts" })).rejects.toThrow()
  })

  test("unregister non-existent does nothing", () => {
    const r = new RouteRegistry()
    r.unregister("/nope")
    expect(r.list).toHaveLength(0)
  })

  test("clear removes all", async () => {
    const r = new RouteRegistry()
    await r.register({ pattern: "/a", path: "src/routes/a.ts" })
    await r.register({ pattern: "/b", path: "src/routes/b.ts" })
    expect(r.list).toHaveLength(2)
    r.clear()
    expect(r.list).toHaveLength(0)
  })

  test("stats patterns match registered routes", async () => {
    const r = new RouteRegistry()
    await r.register({ pattern: "/x", path: "src/routes/x.ts" })
    await r.register({ pattern: "/y", path: "src/routes/y.ts" })
    expect(r.stats.patterns.sort()).toEqual(["/x", "/y"])
  })

  test("restart unregisters the route", async () => {
    const r = new RouteRegistry()
    await r.register({ pattern: "/z", path: "src/routes/z.ts" })
    expect(r.list).toHaveLength(1)
    r.restart("/z")
    expect(r.list).toHaveLength(0)
  })
})
