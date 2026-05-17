import { describe, expect, test, mock } from "bun:test"
import { PluginManager } from "../src/plugins/manager.ts"

describe("PluginIsolator IPC", () => {
  test("in-process plugin install and uninstall", async () => {
    const pm = new PluginManager()
    const installMock = mock(() => {})
    const uninstallMock = mock(() => {})

    await pm.install(
      { name: "test-ipc", version: "1.0", install: installMock, uninstall: uninstallMock },
      { logger: undefined, on: () => {}, broadcast: () => {} },
    )

    expect(pm.list).toHaveLength(1)
    expect(pm.list[0]!.name).toBe("test-ipc")
    expect(installMock).toHaveBeenCalled()

    await pm.uninstall("test-ipc")
    expect(uninstallMock).toHaveBeenCalled()
    expect(pm.list).toHaveLength(0)
  })

  test("send to unknown plugin does nothing", async () => {
    const pm = new PluginManager()
    await pm.send("nonexistent", "test-channel", { data: 1 })
    // should not throw
  })

  test("clear terminates all plugins", async () => {
    const pm = new PluginManager()
    const installMock = mock(() => {})

    await pm.install(
      { name: "clear-test", version: "1.0", install: installMock },
      { logger: undefined, on: () => {}, broadcast: () => {} },
    )

    pm.clear()
    expect(pm.list).toHaveLength(0)
  })

  test("multiple plugin isolation", async () => {
    const pm = new PluginManager()
    const ctx = { logger: undefined, on: () => {}, broadcast: () => {} }

    await pm.install({ name: "p1", version: "1.0", install: mock(() => {}) }, ctx)
    await pm.install({ name: "p2", version: "1.0", install: mock(() => {}) }, ctx)
    await pm.install({ name: "p3", version: "1.0", install: mock(() => {}) }, ctx)

    expect(pm.list).toHaveLength(3)
    expect(pm.list.map(h => h.name).sort()).toEqual(["p1", "p2", "p3"])

    pm.clear()
    expect(pm.list).toHaveLength(0)
  })

  test("install rejects on duplicate", async () => {
    const pm = new PluginManager()
    const ctx = { logger: undefined, on: () => {}, broadcast: () => {} }
    await pm.install({ name: "unique", version: "1.0" }, ctx)
    expect(pm.install({ name: "unique", version: "1.0" }, ctx)).rejects.toThrow()
  })

  test("uninstall on non-existent throws", async () => {
    const pm = new PluginManager()
    expect(pm.uninstall("ghost")).rejects.toThrow()
  })
})
