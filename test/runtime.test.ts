import { describe, expect, test, mock, afterAll } from "bun:test"
import { Runtime } from "../src/runtime.ts"

describe("Runtime — Full PRD", () => {
  afterAll(() => {
    process.removeAllListeners("SIGINT")
    process.removeAllListeners("SIGTERM")
    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")
  })

  test("state starts as init", () => {
    const r = new Runtime()
    expect(r.state).toBe("init")
    expect(r.uptime).toBe(0)
  })

  test("boot transitions through full lifecycle", () => {
    const r = new Runtime()
    const order: string[] = []
    r.on("boot", () => { order.push("boot") })
    r.on("plugin-init", () => { order.push("plugin-init") })
    r.on("starting-server", () => { order.push("starting-server") })
    r.on("ready", () => { order.push("ready") })
    r.on("running", () => { order.push("running") })
    r.boot({ signals: false })
    expect(order).toEqual(["boot", "plugin-init", "starting-server", "ready", "running"])
    expect(r.state).toBe("running")
  })

  test("logger is available after boot", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    expect(r.logger).toBeDefined()
    expect(r.logger?.level).toBe("info")
  })

  test("cannot boot twice", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    expect(() => r.boot()).toThrow("already booted")
  })

  test("on('ready') fires after boot", () => {
    const r = new Runtime()
    const ready = mock(() => {})
    r.on("ready", ready)
    r.boot({ signals: false })
    expect(ready).toHaveBeenCalledTimes(1)
  })

  test("off removes handler", () => {
    const r = new Runtime()
    const handler = mock(() => {})
    r.on("ready", handler)
    r.off("ready", handler)
    r.boot({ signals: false })
    expect(handler).not.toHaveBeenCalled()
  })

  test("degrade and recover", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    expect(r.state).toBe("running")

    const degraded = mock(() => {})
    const recovered = mock(() => {})
    r.on("degraded", degraded)
    r.on("recovering", recovered)

    r.degrade()
    expect(r.state).toBe("degraded")
    expect(degraded).toHaveBeenCalled()

    r.recover()
    expect(r.state).toBe("running")
    expect(recovered).toHaveBeenCalled()
  })

  test("boot with telemetry enabled", () => {
    const r = new Runtime()
    r.boot({ telemetry: true, signals: false })
    expect(r.telemetry).toBeDefined()
    expect(r.telemetry?.started).toBe(true)
    r.telemetry?.stop()
  })

  test("boot with plugins", () => {
    const r = new Runtime()
    const plugin = {
      name: "test-plugin",
      version: "1.0.0",
      install: mock(() => {}),
    }
    r.boot({ plugins: [plugin], signals: false })
    expect(r.plugins.count).toBe(1)
    expect(plugin.install).toHaveBeenCalled()
  })

  test("use plugin with isolation", () => {
    const r = new Runtime()
    r.__testing()
    r.boot({ signals: false })
    const plugin = {
      name: "isolated-plugin",
      install: mock(() => {}),
    }
    r.use(plugin, { isolate: true })
    expect(r.plugins.count).toBe(1)
  })

  test("use plugin as file path with worker isolation", async () => {
    const r = new Runtime()
    r.__testing()
    r.boot({ signals: false })

    const pluginPath = new URL("./fixtures/test-worker-plugin.ts", import.meta.url).pathname
    r.use(pluginPath, { isolate: true })

    // Wait a bit for the worker to spawn and install
    await Bun.sleep(500)
    expect(r.plugins.count).toBe(1)
  })

  test("broadcast publishes to subscribers", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    const handler = mock(() => {})
    r.bus.subscribe("test", handler)
    r.broadcast("test", { data: 42 })
    expect(handler).toHaveBeenCalledWith({ data: 42 }, "test")
  })

  test("metrics API returns telemetry data", () => {
    const r = new Runtime()
    r.boot({ telemetry: true, signals: false })
    const mem = r.metrics.memory()
    expect(mem.heapUsed).toBeGreaterThan(0)
    const el = r.metrics.eventLoop()
    expect(typeof el.lag).toBe("number")
    const cpu = r.metrics.cpu()
    expect(typeof cpu.user).toBe("number")
    r.telemetry?.stop()
  })

  test("metrics serve returns zeros when no server used", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    const m = r.metrics.serve()
    expect(m).not.toBeNull()
    expect(m?.totalRequests).toBe(0)
    expect(m?.activeRequests).toBe(0)
  })

  test("wrapFetch tracks request metrics", async () => {
    const r = new Runtime()
    r.boot({ signals: false })
    const wrapped = r.wrapFetch(async () => new Response("ok", { status: 200 }))
    await wrapped(new Request("http://test.com"))
    const serveMetrics = r.metrics.serve()
    expect(serveMetrics).not.toBeNull()
    expect(serveMetrics?.totalRequests).toBe(1)
    expect(serveMetrics?.statusCounts[200]).toBe(1)
  })

  test("once fires only once", () => {
    const r = new Runtime()
    let count = 0
    r.once("ready", () => { count++ })
    r.boot({ signals: false })
    expect(count).toBe(1)
  })

  test("publish is alias for broadcast", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    const handler = mock(() => {})
    r.bus.subscribe("test", handler)
    r.publish("test", "via-publish")
    expect(handler).toHaveBeenCalledWith("via-publish", "test")
  })

  test("stats returns all runtime info", () => {
    const r = new Runtime()
    expect(r.stats().state).toBe("init")
    r.boot({ telemetry: true, signals: false })
    const stats = r.stats()
    expect(stats.state).toBe("running")
    expect(stats.uptime).toBeGreaterThanOrEqual(0)
    expect(stats.startedAt).toBeTruthy()
    expect(typeof stats.telemetry).toBe("boolean")
    r.telemetry?.stop()
  })

  test("onMemoryLeak creates watchdog", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    const handler = mock(() => {})
    const watchdog = r.onMemoryLeak(handler)
    expect(watchdog.stats.active).toBe(true)
    watchdog.stop()
  })

  test("tracer start/end", () => {
    const r = new Runtime()
    r.boot({ signals: false })
    const id = r.tracer.start("test-span")
    const span = r.tracer.end(id)
    expect(span).not.toBeNull()
    expect(span?.name).toBe("test-span")
  })
})
