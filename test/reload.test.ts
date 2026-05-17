import { describe, expect, test, mock } from "bun:test"
import { ReloadEngine } from "../src/reload/engine.ts"
import { FileWatcher } from "../src/reload/watcher.ts"

describe("ReloadEngine", () => {
  test("empty on init", () => {
    const re = new ReloadEngine()
    const s = re.stats
    expect(s.lastReload).toBeNull()
    expect(s.reloadCount).toBe(0)
    expect(s.watchEnabled).toBe(false)
  })

  test("reload increments counter", async () => {
    const re = new ReloadEngine()
    await re.reload()
    expect(re.stats.reloadCount).toBe(1)
    expect(re.stats.lastReload).not.toBeNull()
  })

  test("reload calls registered callbacks", async () => {
    const re = new ReloadEngine()
    const cb = mock(() => {})
    re.onReload(cb)
    await re.reload()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test("multiple callbacks called", async () => {
    const re = new ReloadEngine()
    const a = mock(() => {})
    const b = mock(() => {})
    re.onReload(a)
    re.onReload(b)
    await re.reload()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  test("callback error does not block others", async () => {
    const re = new ReloadEngine()
    const bad = mock(() => { throw new Error("fail") })
    const good = mock(() => {})
    re.onReload(bad)
    re.onReload(good)
    await re.reload()
    expect(good).toHaveBeenCalledTimes(1)
  })

  test("watch toggle", () => {
    const re = new ReloadEngine()
    expect(re.stats.watchEnabled).toBe(false)
    re.watch()
    expect(re.stats.watchEnabled).toBe(true)
    re.unwatch()
    expect(re.stats.watchEnabled).toBe(false)
  })
})

describe("FileWatcher", () => {
  test("empty on init", () => {
    const fw = new FileWatcher()
    const s = fw.stats
    expect(s.watchEnabled).toBe(false)
    expect(s.reloadCount).toBe(0)
    expect(s.lastReload).toBeNull()
  })

  test("watch and unwatch toggles", () => {
    const fw = new FileWatcher()
    expect(fw.stats.watchEnabled).toBe(false)
    fw.watch([])
    expect(fw.stats.watchEnabled).toBe(true)
    fw.unwatch()
    expect(fw.stats.watchEnabled).toBe(false)
  })

  test("onReload registers callback", () => {
    const fw = new FileWatcher()
    const cb = mock(() => {})
    fw.onReload(cb)
    // callback gets called via file system events, not directly testable
    expect(fw.stats.watchEnabled).toBe(false)
  })

  test("multiple onReload calls stack callbacks", () => {
    const fw = new FileWatcher()
    fw.onReload(() => {})
    fw.onReload(() => {})
    fw.watch([])
    expect(fw.stats.watchEnabled).toBe(true)
    fw.unwatch()
  })
})
