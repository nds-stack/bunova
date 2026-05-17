import { describe, expect, test, mock } from "bun:test"
import { PluginManager } from "../src/plugins/manager.ts"
import type { PluginContext } from "../src/types.ts"

describe("PluginManager", () => {
  const ctx: PluginContext = {
    logger: undefined,
    on: () => {},
    broadcast: () => {},
  }

  test("install plugin", async () => {
    const pm = new PluginManager()
    const plugin = { name: "test", install: mock(() => {}) }
    await pm.install(plugin, ctx)
    expect(pm.count).toBe(1)
    expect(plugin.install).toHaveBeenCalled()
  })

  test("install duplicate throws", async () => {
    const pm = new PluginManager()
    const plugin = { name: "dup", install: mock(() => {}) }
    await pm.install(plugin, ctx)
    await expect(pm.install(plugin, ctx)).rejects.toThrow("already installed")
  })

  test("list returns plugin handles", async () => {
    const pm = new PluginManager()
    await pm.install({ name: "a", install: mock(() => {}) }, ctx)
    await pm.install({ name: "b", install: mock(() => {}) }, ctx)
    const list = pm.list
    expect(list).toHaveLength(2)
  })

  test("uninstall removes plugin", async () => {
    const pm = new PluginManager()
    const uninstall = mock(() => {})
    await pm.install({ name: "u", install: mock(() => {}), uninstall }, ctx)
    expect(pm.count).toBe(1)
    await pm.uninstall("u")
    expect(pm.count).toBe(0)
    expect(uninstall).toHaveBeenCalled()
  })

  test("isolated flag in handle", async () => {
    const pm = new PluginManager()
    await pm.install({ name: "iso", install: mock(() => {}) }, ctx, { isolate: true })
    const handle = pm.list[0]
    expect(handle?.isolated).toBe(true)
  })

  test("get returns plugin by name", async () => {
    const pm = new PluginManager()
    await pm.install({ name: "g", install: mock(() => {}) }, ctx)
    const p = pm.get("g")
    expect(p).toBeDefined()
  })

  test("clear removes all", async () => {
    const pm = new PluginManager()
    await pm.install({ name: "a", install: mock(() => {}) }, ctx)
    await pm.install({ name: "b", install: mock(() => {}) }, ctx)
    pm.clear()
    expect(pm.count).toBe(0)
  })

  test("install failure cleans up", async () => {
    const pm = new PluginManager()
    const plugin = { name: "fail", install: mock(() => { throw new Error("fail") }) }
    await expect(pm.install(plugin, ctx)).rejects.toThrow("fail")
    expect(pm.count).toBe(0)
  })
})
