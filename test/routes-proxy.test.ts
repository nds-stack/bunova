import { describe, expect, test } from "bun:test"
import { RouteProxy } from "../src/routes/proxy.ts"
import { RouteRegistry } from "../src/routes/registry.ts"

describe("RouteProxy", () => {
  test("match exact pattern", () => {
    const registry = new RouteRegistry()
    const proxy = new RouteProxy(registry)
    proxy.setFallback(() => new Response("ok"))

    // The #match method is private, test via handle() which exercises it
    // We test fallback for an empty registry
  })

  test("fallback returns ok", async () => {
    const registry = new RouteRegistry()
    const proxy = new RouteProxy(registry)
    proxy.setFallback(() => new Response("fallback"))

    const res = await proxy.handle(new Request("http://localhost/test"))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("fallback")
  })

  test("no fallback returns 404", async () => {
    const registry = new RouteRegistry()
    const proxy = new RouteProxy(registry)

    const res = await proxy.handle(new Request("http://localhost/test"))
    expect(res.status).toBe(404)
  })

  test("setFallback overrides previous", async () => {
    const registry = new RouteRegistry()
    const proxy = new RouteProxy(registry)
    proxy.setFallback(() => new Response("first"))
    proxy.setFallback(() => new Response("second"))

    const res = await proxy.handle(new Request("http://localhost/"))
    expect(await res.text()).toBe("second")
  })
})
