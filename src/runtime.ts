import pkg from "../package.json"
import { RuntimeCore } from "./runtime-core.ts"
import { BunLogger, ConsoleTransport } from "@nds-stack/bun-logger"
import { env as validateEnv } from "@nds-stack/bun-env"
import { ScopedBus } from "./bus/scoped-bus.ts"
import { MemoryWatchdog } from "./monitoring/memory-watchdog.ts"
import { ObservabilityManager } from "./managers/observability-manager.ts"
import { OrchestrationManager } from "./managers/orchestration-manager.ts"
import {
  makePluginContext,
  emitLifecycle,
  inferPattern,
  groupRoutesByDir,
} from "./boot.ts"
import type {
  BootOptions,
  LifecycleHandler,
  LifecycleEvent,
  RuntimeStats,
  LifecycleState,
  Plugin,
  PluginUseOptions,
  ReloadOptions,
  MetricsAPI,
  WatchdogOptions,
} from "./types.ts"

export class Runtime {
  #core = new RuntimeCore()

  __testing(): void {
    this.#core.testing = true
    process.env.BUNOVA_TESTING = "1"
  }

  get state(): LifecycleState {
    return this.#core.lifecycle.state
  }

  get uptime(): number {
    if (!this.#core.startedAt) return 0
    return Date.now() - new Date(this.#core.startedAt).getTime()
  }

  get logger() {
    return this.#core.logger
  }

  // ── Lifecycle ──

  on(event: LifecycleEvent, handler: LifecycleHandler): void {
    this.#core.lifecycle.on(event, handler)
  }

  off(event: LifecycleEvent, handler: LifecycleHandler): void {
    this.#core.lifecycle.off(event, handler)
  }

  once(event: LifecycleEvent, handler: LifecycleHandler): void {
    this.#core.lifecycle.once(event, handler)
  }

  get workerLifecycle() {
    return this.#core.workerLifecycle
  }

  get pluginLifecycle() {
    return this.#core.pluginLifecycle
  }

  get routeLifecycle() {
    return this.#core.routeLifecycle
  }

  degrade(): void {
    const lc = this.#core.lifecycle
    if (lc.state !== "running") return
    lc.transition("degraded")
    emitLifecycle(this.#core, "degraded")
  }

  recover(): void {
    const lc = this.#core.lifecycle
    if (lc.state !== "degraded") return
    lc.transition("recovering")
    emitLifecycle(this.#core, "recovering")
    lc.transition("running")
    emitLifecycle(this.#core, "running")
  }

  serverStart(): void {
    this.#core.logger?.warn("serverStart() is automatic — boot() transitions through all states")
  }

  // ── Plugins ──

  get plugins() {
    return this.#core.plugins
  }

  use(plugin: Plugin | string, options?: PluginUseOptions): void {
    const c = this.#core
    const name = typeof plugin === "string"
      ? plugin.split("/").pop()?.replace(/\.(ts|js)$/, "") ?? "file-plugin"
      : plugin.name

    const ctx = makePluginContext(c, c.lifecycle)

    c.plugins.install(plugin, ctx, options).catch((err) => {
      c.logger?.error(`Failed to install plugin "${name}"`, err)
      if (!c.testing) {
        c.lifecycle.crash(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  async pluginSend(name: string, channel: string, payload?: unknown): Promise<void> {
    await this.#core.plugins.send(name, channel, payload)
  }

  // ── Bus ──

  get bus() {
    return this.#core.bus
  }

  #eventsScopes = new Map<string, ScopedBus>()

  get events(): {
    worker: ScopedBus
    plugin: ScopedBus
    route: ScopedBus
    telemetry: ScopedBus
  } {
    const get = (prefix: string) => {
      let bus = this.#eventsScopes.get(prefix)
      if (!bus) {
        bus = new ScopedBus(this.#core.bus, prefix)
        this.#eventsScopes.set(prefix, bus)
      }
      return bus
    }
    return {
      worker: get("worker"),
      plugin: get("plugin"),
      route: get("route"),
      telemetry: get("telemetry"),
    }
  }

  broadcast(channel: string, payload?: unknown): void {
    this.#core.bus.publish(channel, payload)
  }

  publish(channel: string, payload?: unknown): void {
    this.#core.bus.publish(channel, payload)
  }

  // ── Observability Manager ──

  get telemetry() {
    return this.#core.observability.telemetry
  }

  get tracer() {
    return this.#core.tracer
  }

  get serveMonitor() {
    return this.#core.observability.serveMonitor
  }

  get metrics(): MetricsAPI {
    return this.#core.observability.metrics
  }

  onMemoryLeak(handler: () => void | Promise<void>, options?: WatchdogOptions): MemoryWatchdog {
    return this.#core.observability.onMemoryLeak(handler, options)
  }

  wrapFetch(fetch: (request: Request) => Response | Promise<Response>): (request: Request) => Promise<Response> {
    return this.#core.observability.wrapFetch(fetch)
  }

  // ── Orchestration Manager ──

  get worker() {
    return this.#core.orchestration.workers
  }

  // ── Routing Manager ──

  get routes() {
    return this.#core.routing.registry
  }

  get routeProxy() {
    return this.#core.routing.proxy
  }

  serve(options: { port?: number; fetch?: (request: Request) => Response | Promise<Response> }): void {
    const c = this.#core
    if (options.fetch) c.routing.setFallback(options.fetch)

    const handler = this.wrapFetch(async (request) => c.routing.handle(request))

    Bun.serve({ port: options.port ?? 3000, fetch: handler })
    c.logger?.info(`Runtime serving on :${options.port ?? 3000}`)
  }

  // ── Reload Manager ──

  get reloadEngine() {
    return this.#core.reload.engine
  }

  reload(options?: ReloadOptions): void {
    this.#core.reload.engine.reload(options)
  }

  // ── Boot ──

  async boot(options: BootOptions = {}): Promise<void> {
    if (this.#core.booted) throw new Error("Runtime already booted")
    const c = this.#core
    c.booted = true

    // Logger
    const loggerOpts = options.logger ?? {}
    const logger = new BunLogger({ level: loggerOpts.level ?? "info", format: loggerOpts.format ?? "json", meta: { runtime: "bunova", ...loggerOpts.meta } })
    if (!loggerOpts.transports || loggerOpts.transports.length === 0) {
      logger.addTransport(new ConsoleTransport())
    } else {
      for (const t of loggerOpts.transports) logger.addTransport(t)
    }
    c.logger = logger
    c.orchestration.setLogger(logger)
    c.reload.setLogger(logger)
    logger.info("Runtime booting", { version: pkg.version })

    // Env
    if (options.env?.schema) {
      try {
        const result = validateEnv(options.env.schema)
        logger.info("Environment validated", { valid: true, keys: Object.keys(result) })
      } catch (err) {
        logger.error("Environment validation failed", err)
        throw err
      }
    }

    // Signals
    if (options.signals ?? true) {
      process.on("SIGINT", () => { logger.info("Received SIGINT"); this.shutdown(0) })
      process.on("SIGTERM", () => { logger.info("Received SIGTERM"); this.shutdown(0) })
      process.on("uncaughtException", (err) => { logger.error("Uncaught exception", err); c.lifecycle.crash(err) })
      process.on("unhandledRejection", (reason) => {
        const err = reason instanceof Error ? reason : new Error(String(reason))
        logger.error("Unhandled rejection", err)
        c.lifecycle.crash(err)
      })
    }

    c.lifecycle.transition("booting")
    c.startedAt = new Date().toISOString()
    emitLifecycle(c, "boot")

    // Crash handler + bus error handler
    c.lifecycle.on("crash", (err) => { logger.error("Runtime crashed", err); if (!c.testing) process.exit(1) })
    c.bus.onError((channel, error) => logger.error(`MessageBus handler error on channel "${channel}"`, error))

    // Plugins
    if (options.plugins) {
      for (const plugin of options.plugins) this.use(plugin)
    }
    c.lifecycle.transition("plugin-init")
    emitLifecycle(c, "plugin-init")

    // Starting server
    c.lifecycle.transition("starting-server")
    emitLifecycle(c, "starting-server")

    // Observability
    const telemetryOpts = options.telemetry
    c.observability = telemetryOpts === undefined
      ? ObservabilityManager.createEmpty()
      : ObservabilityManager.create(telemetryOpts === true ? {} : telemetryOpts)

    // Plugin listeners + lifecycle bridges
    c.bus.subscribe("plugin:error", (p) => {
      const payload = p as Record<string, unknown>
      const plugin = typeof payload?.plugin === "string" ? payload.plugin : "unknown"
      const err = typeof payload?.error === "string" ? payload.error : "unknown error"
      logger.error(`Plugin error: ${plugin}`, err)
      c.pluginLifecycle.emit("error", p)
    })
    c.bus.subscribe("plugin:crashed", (p) => {
      const payload = p as Record<string, unknown>
      const plugin = typeof payload?.plugin === "string" ? payload.plugin : "unknown"
      const exitCode = typeof payload?.exitCode === "number" ? payload.exitCode : -1
      logger.error(`Plugin crashed: ${plugin}`, { exitCode })
      c.pluginLifecycle.emit("crashed", p)
    })
    c.bus.subscribe("plugin:isolated", (p) => { c.pluginLifecycle.emit("isolated", p) })

    // Discovery
    if (options.discovery) {
      c.orchestration = OrchestrationManager.create(true)
      c.orchestration.setLogger(logger)
      const result = await c.orchestration.autoDiscover()
      if (result && result.routes.length > 0) {
        const routeDefs = result.routes.map(path => ({ pattern: inferPattern(path), path }))
        const groups = groupRoutesByDir(routeDefs)
        for (const [key, defs] of groups) {
          if (defs.length === 1) {
            c.routing.register(defs[0]!).catch((err) => logger.error(`Failed to register route: ${defs[0]!.path}`, err))
          } else {
            c.routing.registerGroup(key, defs).catch((err) => logger.error(`Failed to register route group: ${key}`, err))
          }
        }
      }
    }

    // Watcher
    if (options.watch) {
      const watchConfig = typeof options.watch === "object" ? options.watch : { dirs: ["src", "src/routes"] }
      const dirs = watchConfig.dirs ?? ["src", "src/routes"]
      c.reload.onFileChange(async (event) => {
        logger.info(`File changed: ${event.path}`)
        c.reload.engine.reload()
        c.orchestration.workers.restart()
        if (event.path.includes("/routes/") && c.orchestration.discovery) {
          const result = await c.orchestration.discovery.scan()
          for (const route of c.routing.list) c.routing.unregister(route.pattern)
          const routeDefs = result.routes.map(path => ({ pattern: inferPattern(path), path }))
          const groups = groupRoutesByDir(routeDefs)
          for (const [key, defs] of groups) {
            if (defs.length === 1) {
              c.routing.register(defs[0]!).catch((err) => logger.error(`Failed to re-register route: ${defs[0]!.path}`, err))
            } else {
              c.routing.registerGroup(key, defs).catch((err) => logger.error(`Failed to re-register route group: ${key}`, err))
            }
          }
        }
      })
      c.reload.watch(dirs)
    }

    c.lifecycle.transition("ready")
    emitLifecycle(c, "ready")
    c.lifecycle.transition("running")
    emitLifecycle(c, "running")
  }

  #shutdownTimer: Timer | null = null

  async shutdown(exitCode = 0): Promise<void> {
    const c = this.#core
    const state = c.lifecycle.state
    if (state !== "ready" && state !== "running" && state !== "degraded"
      && state !== "recovering" && state !== "plugin-init") return
    c.lifecycle.transition("shutting-down")
    c.logger?.info("Runtime shutting down gracefully")
    c.observability.stop()
    c.orchestration.stopAll()
    c.plugins.clear()
    await emitLifecycle(c, "shutdown")
    if (!c.testing) {
      if (this.#shutdownTimer) clearTimeout(this.#shutdownTimer)
      this.#shutdownTimer = setTimeout(() => process.exit(exitCode), 100)
    }
  }

  stats(): RuntimeStats {
    const c = this.#core
    return {
      state: c.lifecycle.state,
      uptime: this.uptime,
      startedAt: c.startedAt,
      workers: c.orchestration.workers.count,
      plugins: c.plugins.count,
      telemetry: c.observability.telemetry?.started ?? false,
      watchEnabled: c.reload.watcher.stats.watchEnabled,
      discoveryEnabled: c.orchestration.discovery !== undefined,
    }
  }
}

// inferPattern moved to boot.ts
