# Bunova — Application Runtime Layer for Bun

[![npm version](https://img.shields.io/npm/v/bunova)](https://www.npmjs.com/package/bunova)
[![bun](https://img.shields.io/badge/runtime-bun-%23f9f9f9)](https://bun.sh)
[![license](https://img.shields.io/npm/l/bunova)](LICENSE)

```ts
import { runtime } from "bunova"

runtime.boot()
```

Bunova is a **Bun-native application runtime layer** — not a process manager.
It runs inside your application alongside your application lifecycle, giving you lifecycle hooks, telemetry, plugins, worker orchestration, and observability without external daemons.

## Installation

```bash
bun add bunova
```

Or install from source:

```bash
bun link                       # from the bunova project directory
bun link bunova                # in your application project
```

## Why Bunova?

Traditional Node.js applications rely on multiple external tools to do what Bun already provides natively:

| Problem | Old Way |
|---------|---------|
| Auto restart | PM2 |
| Watch mode | Nodemon |
| Logger | Winston |
| Runtime monitoring | NewRelic / Datadog |
| Process management | systemd / PM2 |
| Signal handling | Custom scripts |

Bun already has native TypeScript, fast startup, native SQLite, and native WebSocket.
But the tooling ecosystem still follows old Node.js patterns — external daemons, redundant architecture, fragmented observability.

Bunova fills this gap: a **cohesive runtime experience** for Bun applications that is application-aware, not process-oriented.

## Philosophy

- **Lifecycle-driven** — application state is explicit and observable (init → booting → plugin-init → starting-server → ready → running → degraded → recovering → shutting-down → crashed)
- **Application-aware** — understands routes, workers, plugins, and memory, not just process up/down
- **Bun-native** — leverages Bun APIs directly, not Node.js polyfills
- **Observability-first** — every runtime has built-in metrics, telemetry, and introspection without setup
- **Progressive complexity** — `runtime.boot()` for beginners, `runtime.worker.spawn()` for experts

## Architecture

```text
   User Application (Bun.serve, custom logic)
       │
       ▼
┌──────────────────────────────────────────────────┐
│                    Runtime                        │
│               (facade / entry point)              │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│                  RuntimeCore                      │
│           (kernel — holds all managers)           │
│                                                   │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Lifecycle │ │  MessageBus  │ │   Plugins    │ │
│  │   State   │ │ (transport-  │ │   Manager    │ │
│  │ Machine   │ │  agnostic)   │ │install/uninst│ │
│  └────┬─────┘ └──────┬───────┘ └──────┬───────┘ │
│       │              │                │         │
│  ┌────▼──────────────▼────────────────▼───────┐ │
│  │          ObservabilityManager               │ │
│  │  ┌──────────┐┌──────────┐┌──────────────┐ │ │
│  │  │Telemetry ││   Mem    ││  Bun.serve   │ │ │
│  │  │Memory CPU││ Watchdog ││  Monitor     │ │ │
│  │  │Evt Loop  ││          ││ (wrapFetch)  │ │ │
│  │  └──────────┘└──────────┘└──────────────┘ │ │
│  │  ┌──────────┐┌──────────┐┌──────────────┐ │ │
│  │  │  Tracer  ││ Metrics  ││     IPC      │ │ │
│  │  │span-based││   API    ││ MessageStream│ │ │
│  │  └──────────┘└──────────┘└──────────────┘ │ │
│  └────────────────┬──────────────────────────┘ │
│                   │                            │
│  ┌────────────────▼──────────────────────────┐ │
│  │          OrchestrationManager              │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ │ │
│  │  │Worker Orchestratr│ │   Discovery     │ │ │
│  │  │ spawn/health-    │ │ auto-scan       │ │ │
│  │  │ check/recycle    │ │ plugins/workrs  │ │ │
│  │  │ /backoff         │ │ /routes dirs    │ │ │
│  │  └─────────────────┘ └─────────────────┘ │ │
│  └────────────────┬──────────────────────────┘ │
│                   │                            │
│  ┌────────────────▼──────────────────────────┐ │
│  │            RoutingManager                  │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ │ │
│  │  │  RouteRegistry   │ │   RouteProxy    │ │ │
│  │  │ route workers +  │ │ URL pattern     │ │ │
│  │  │ route groups     │ │ matching +proxy │ │ │
│  │  └─────────────────┘ └─────────────────┘ │ │
│  └────────────────┬──────────────────────────┘ │
│                   │                            │
│  ┌────────────────▼──────────────────────────┐ │
│  │            ReloadManager                   │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ │ │
│  │  │   ReloadEngine   │ │   FileWatcher   │ │ │
│  │  │  onReload cb     │ │ fs.watch dirs   │ │ │
│  │  └─────────────────┘ └─────────────────┘ │ │
│  └───────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
       │
       ▼
   Bun Runtime (native: serve, sqlite, websocket, fetch, spawn)
       │
       ▼
   OS Layer (signals, processes, file system)
```

## How It Works

Bunova wraps your Bun application with a lightweight runtime that manages:

- **Lifecycle** — state machine (init → booting → plugin-init → ready → shutting-down → crashed)
- **Hooks** — event-driven lifecycle callbacks (`boot`, `plugin-init`, `ready`, `shutdown`, `crash`)
- **Logging** — structured logging via `@nds-stack/bun-logger` (console, file, custom transports)
- **Env validation** — schema-based coercion via `@nds-stack/bun-env` (fail-fast at boot)
- **Signal handling** — automatic graceful shutdown on SIGINT/SIGTERM
- **Telemetry** — automatic memory and event-loop lag collection (optional, Phase 1)
- **Plugin system** — install/uninstall lifecycle with runtime hooks (runtime.use)
- **Worker orchestration** — spawn isolated Bun processes with auto-restart
- **Message bus** — publish/subscribe across runtime components
- **Memory watchdog** — threshold-based breach detection with custom callbacks
- **Tracing** — lightweight span-based tracer for debugging
- **Crash recovery** — Tiny Bootstrap supervisor for auto-restart

## API

### `runtime.boot(options?)`

Initialize the runtime. Call once at application entry.

```ts
import { runtime } from "bunova"

// Minimal
runtime.boot()

// With options
runtime.boot({
  logger: { level: "debug" },
  env: { schema: { PORT: "port", DB_URL: "url" } },
  telemetry: true,
  signals: true,
})
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `BunLoggerOptions` | `{ level: "info" }` | Logger configuration from `@nds-stack/bun-logger` |
| `env` | `{ schema: EnvSchema }` | — | Env schema from `@nds-stack/bun-env` for validation |
| `telemetry` | `boolean \| TelemetryOptions` | — | Enable automatic telemetry collection |
| `plugins` | `Plugin[]` | — | Plugins to install at boot |
| `signals` | `boolean` | `true` | Auto-register SIGINT/SIGTERM/uncaughtException handlers |
| `discovery` | `boolean` | — | Auto-scan src/plugins/, src/workers/, src/routes/ |
| `watch` | `boolean \| { dirs: string[] }` | — | File watcher for boundary reload on change |

### `runtime.on(event, handler)`

Register a lifecycle hook.

```ts
runtime.on("boot", () => { /* runtime booting */ })
runtime.on("plugin-init", () => { /* plugins loaded */ })
runtime.on("starting-server", () => { /* server starting */ })
runtime.on("ready", () => { /* application ready */ })
runtime.on("running", () => { /* fully operational */ })
runtime.on("degraded", (reason) => { /* health issue detected */ })
runtime.on("recovering", () => { /* attempting recovery */ })
runtime.on("shutdown", () => { /* cleanup before exit */ })
runtime.on("crash", (err) => { /* unrecoverable error */ })
```

**Events:**

| Event | Fired when | State |
|-------|-----------|-------|
| `boot` | Runtime starts initialization | booting |
| `plugin-init` | Plugins loaded successfully | plugin-init |
| `starting-server` | About to start server | starting-server |
| `ready` | Runtime fully initialized | ready |
| `running` | Fully operational | running |
| `degraded` | Health issue detected | degraded |
| `recovering` | Attempting recovery | recovering |
| `shutdown` | Graceful shutdown initiated | shutting-down |
| `crash` | Unrecoverable error occurred | crashed |

### `runtime.off(event, handler)`

Remove a previously registered handler.

### `runtime.once(event, handler)`

Register a one-shot handler that fires once and auto-removes.

```ts
runtime.once("ready", () => {
  console.log("This fires only once")
})
```

### `runtime.shutdown(exitCode?)`

Manually trigger graceful shutdown.

```ts
await runtime.shutdown(0)
```

### `runtime.use(plugin, options?)`

Install a plugin at runtime. Accepts a plugin object (in-process) or a file path (worker-isolated).

**In-process plugin (default):**

```ts
runtime.use({
  name: "my-plugin",
  version: "1.0.0",
  install(ctx) {
    ctx.on("ready", () => { /* plugin ready */ })
    ctx.broadcast("my-plugin:ready", {})
  },
})
```

**Worker-isolated plugin (file path):**

```ts
runtime.use("./plugins/redis-monitor.ts", { isolate: true })
// Spawned as separate Bun process — crash doesn't affect main runtime
```

When `{ isolate: true }` is combined with a file path, the plugin is loaded in a separate Bun subprocess.
The plugin file should export a `default` object with `{ name, version, install?, uninstall? }`.

### `runtime.broadcast(channel, payload?)`

Publish a message to the internal message bus.

```ts
runtime.broadcast("cache:clear", { pattern: "users:*" })
```

Alias: `runtime.publish(channel, payload?)`

### `runtime.stats()`

Get runtime statistics.

```ts
const stats = runtime.stats()
// { state: "ready", uptime: 12345, startedAt: "...", workers: 2, plugins: 1, telemetry: true }
```

### `runtime.degrade()` / `runtime.recover()`

Manually transition between health states.

```ts
runtime.degrade()   // running → degraded
runtime.recover()   // degraded → recovering → running
```

### `runtime.pluginSend(name, channel, payload?)`

Send an event to a worker-isolated plugin via IPC.

```ts
runtime.use("./plugins/redis.ts", { isolate: true })
runtime.pluginSend("redis", "config:reload", { maxConnections: 10 })
// Plugin worker receives via stdin, can respond via stdout broadcast
```

### Bus Subscriber

```ts
const unsub = runtime.bus.subscribe("cache:clear", (payload, channel) => {
  console.log(`Received on ${channel}:`, payload)
})
unsub() // unsubscribe
```

### Namespaced Events (ScopedBus)

Subscribe to domain-specific events via namespaced buses:

```ts
// Worker events
runtime.events.worker.on("spawned", (payload) => {})
runtime.events.worker.on("crashed", (payload) => {})

// Plugin events
runtime.events.plugin.on("installed", (payload) => {})
runtime.events.plugin.on("error", (payload) => {})

// Route events
runtime.events.route.on("registered", (payload) => {})
runtime.events.route.on("unregistered", (payload) => {})

// Telemetry events
runtime.events.telemetry.on("snapshot", (payload) => {})

// Manual unsubscribe
const unsub = runtime.events.worker.on("spawned", handler)
unsub()
// or
runtime.events.worker.off("spawned", handler)
```

### Typed Lifecycles (WorkerLifecycle / PluginLifecycle / RouteLifecycle)

First-class lifecycle hooks for subsystems, separate from application lifecycle:

```ts
// Worker lifecycle — typed events
runtime.workerLifecycle.on("spawned", (payload) => {})
runtime.workerLifecycle.on("crashed", (payload) => {})
runtime.workerLifecycle.on("restarted", (payload) => {})
runtime.workerLifecycle.on("stopped", (payload) => {})

// Plugin lifecycle
runtime.pluginLifecycle.on("installed", (payload) => {})
runtime.pluginLifecycle.on("error", (payload) => {})

// Route lifecycle
runtime.routeLifecycle.on("registered", (payload) => {})
runtime.routeLifecycle.on("unregistered", (payload) => {})
```

These are separate from `runtime.on()` (application lifecycle). They use the `lifecycle:*` namespace internally.

### Async Publish (non-blocking)

```ts
// Synchronous — blocks until all handlers complete
runtime.bus.publish("channel", payload)

// Asynchronous — schedules via queueMicrotask, returns immediately
runtime.bus.publishAsync("channel", payload)
```

### Bus Error Handling

```ts
runtime.bus.onError((channel, error) => {
  console.error(`Handler error on ${channel}:`, error)
})
```

### Properties

```ts
runtime.state              // Current lifecycle state
runtime.logger             // BunLogger instance (available after boot)
runtime.uptime             // Milliseconds since boot

// Lifecycle
runtime.on("ready", h)     // Application lifecycle (10 events)
runtime.workerLifecycle    // Worker lifecycle: spawned, crashed, restarted, stopped
runtime.pluginLifecycle    // Plugin lifecycle: installed, uninstalled, error, crashed
runtime.routeLifecycle     // Route lifecycle: registered, unregistered, failed

// Observability
runtime.telemetry          // TelemetryEngine (if enabled in boot)
runtime.tracer             // Tracer — span-based tracing
runtime.metrics            // MetricsAPI — .memory(), .cpu(), .eventLoop(), .snapshot(), .serve()

// Worker
runtime.worker             // WorkerOrchestrator

// Plugins
runtime.plugins            // PluginManager

// Bus
runtime.bus                // MessageBus — .publish(), .subscribe(), .publishAsync()
runtime.events             // Namespaced: .worker, .plugin, .route, .telemetry

// Routes
runtime.routes             // RouteRegistry
runtime.routeProxy         // RouteProxy

// Reload
runtime.reloadEngine       // ReloadEngine

// Server Monitoring
runtime.serveMonitor       // BunServeMonitor
```

### Telemetry

```ts
runtime.boot({ telemetry: true })

runtime.telemetry.snapshot()
// { memory: { heapUsed, heapTotal, rss }, eventLoop: { lag }, uptime, timestamp }

runtime.telemetry.memory()
// { heapUsed, heapTotal, rss, external, arrayBuffers }

runtime.telemetry.cpu()
// { user, system }

runtime.telemetry.eventLoop()
// { lag }
```

### Worker Orchestration

```ts
const worker = await runtime.worker.spawn("./jobs/email.ts", {
  count: 2,
  restart: true,
  maxRestarts: 10, // optional, default 10
})
// { id, path, pid, status: "running", startedAt, restarts }

runtime.worker.list()   // All workers
runtime.worker.stats()  // Pool statistics
runtime.worker.restart("worker-1")  // Restart specific worker
runtime.worker.stop("worker-1")     // Stop specific worker
```

### Memory Watchdog

```ts
// Default: 200MB threshold, 10s interval
runtime.onMemoryLeak(() => {
  runtime.worker.restart()
})

// With custom options
runtime.onMemoryLeak(() => {
  runtime.worker.restart()
}, { threshold: 500 * 1024 * 1024, interval: 5000 }) // 500MB, 5s
```

### Tracing

```ts
const id = runtime.tracer.start("db-query", undefined, { table: "users" })
// ... do work ...
runtime.tracer.end(id)
// { id, name, duration: 12.3, metadata: { table: "users" } }
```

### Crash Recovery (Bootstrap)

```ts
import { bootstrap } from "bunova"

bootstrap("src/index.ts", {
  restart: true,
  restartDelay: 1000,
  maxRestarts: 10,
})
```

### Native Bun Monitoring

Wrap your Bun.serve fetch handler to track request metrics.

```ts
import { serve } from "bun"

runtime.boot()
const handler = runtime.wrapFetch(async (request) => {
  return new Response("Hello!")
})
serve({ port: 3000, fetch: handler })

// Later: check metrics
runtime.metrics.serve()
// { totalRequests: 100, avgDurationMs: 12.3, statusCounts: { 200: 95, 404: 5 } }
```

### Route Server (with Worker Isolation)

Start a Bun.serve with automatic route worker proxying.

```ts
runtime.boot({ discovery: true }) // scans src/routes/*.ts

// Routes are auto-discovered and spawned as isolated workers
// runtime.serve() proxies matching requests to route workers

runtime.serve({ port: 3000 })
```

Route files in `src/routes/` export a fetch handler:

```ts
// src/routes/users.ts — auto-registered as /users/* pattern
export default {
  async fetch(request: Request): Promise<Response> {
    return new Response("Hello from isolated route worker!")
  }
}
```

Use `runtime.serve()` as a drop-in replacement for `Bun.serve()` when you want route workers. Unmatched requests fall through to a user-provided fetch handler.

**Route Groups:** Routes inside subdirectories share ONE worker for better resource efficiency:

```
src/routes/
├── users.ts              → standalone worker (/users/*)
├── api/
│   ├── users.ts          → grouped under "api" worker (/api/users/*)
│   └── posts.ts          → same worker (/api/posts/*)
```

Routes in the same directory are automatically grouped. One Bun subprocess serves all files, dispatching by URL pattern. This reduces process count for large route trees.

### Smart Reload / Boundary Reload

Enable file watching to reload workers on code changes.

```ts
runtime.boot({ watch: true })
// Watches src/ and src/routes/ for changes
// On change: restarts all workers
```

### Testing

Prevent `process.exit()` during tests:

```ts
import { Runtime } from "bunova"

const r = new Runtime()
r.__testing() // prevents process.exit on crash/shutdown
await r.boot({ signals: false })

// Test: lifecycle hooks work
let ready = false
r.on("ready", () => { ready = true })
expect(ready).toBe(true)

// Test: telemetry
const snap = r.telemetry?.snapshot()
expect(snap?.memory.heapUsed).toBeGreaterThan(0)

r.shutdown() // won't call process.exit
```

### Production Deployment

```bash
# Build
bun run build    # outputs to dist/

# Run with Bun
bun run src/index.ts

# Enable flags
BUNOVA_DEBUG=1 bun run src/index.ts
```

**Recommended production setup:**

```ts
await runtime.boot({
  logger: { level: "info" },
  telemetry: true,       // monitor memory and event loop
  signals: true,         // graceful shutdown on SIGTERM
})
```

For containerized environments, ensure `SIGTERM` is forwarded correctly (Docker/Kubernetes do this by default). Bunova handles graceful shutdown automatically.

## Comparison Table

| Feature | Manual Bun | Bunova |
|---------|-----------|--------|
| Lifecycle state management | Manual | Built-in state machine |
| Graceful shutdown | Manual signal handlers | Auto SIGINT/SIGTERM |
| Structured logging | Bring your own | Pre-configured `@nds-stack/bun-logger` |
| Env validation | Manual | Schema-based via `@nds-stack/bun-env` |
| Telemetry / metrics | — | Memory + event loop monitoring |
| Plugin system | — | Runtime hooks with install/uninstall |
| Worker orchestration | `Bun.spawn()` | Auto-restart + healthcheck |
| Message bus | — | Publish/subscribe |
| Memory watchdog | — | Threshold-based breach detection |
| Tracing | — | Span-based tracer |
| Crash recovery | systemd / PM2 | Tiny Bootstrap supervisor |
| Bundle size | — | ~6 KB (including deps) |

## Benchmarks

```bash
bun run bench
```

| Operation | Throughput | Per Operation |
|-----------|-----------|---------------|
| Cold boot (single) | 8K ops/s | 123 µs |
| State check | 18M ops/s | 55 ns |
| `stats()` | 2.9M ops/s | 343 ns |
| `on`/`off` cycle | 2.9M ops/s | 340 ns |
| `uptime` | 8.2M ops/s | 122 ns |
| MemoryWatchdog create + stop | 1.2M ops/s | 865 ns |

## Use Cases

### 1. Production API Server with Worker Isolation

```ts
import { runtime } from "bunova"

await runtime.boot({
  logger: { level: "info" },
  telemetry: true,
  discovery: true,       // auto-scan src/workers/ and src/routes/
  watch: true,           // auto-reload on code changes
})

runtime.serve({ port: 3000 })
```

Routes in `src/routes/` automatically become isolated workers:

```ts
// src/routes/users.ts
export default {
  async fetch(req: Request) {
    return Response.json({ users: [] })
  }
}
```

### 2. Background Job Worker with Plugin

```ts
import { runtime } from "bunova"
import { queuePlugin } from "@bunova/queue"

await runtime.boot({
  plugins: [queuePlugin({ maxRetries: 3 })],
})

// Enqueue a job
const { enqueue } = runtime.plugins.get("@bunova/queue") as any
enqueue("send-email", { to: "user@example.com" })
```

### 3. Self-Healing Service

```ts
await runtime.boot({ telemetry: true })

// Automatically restart workers when memory breaches 500MB
runtime.onMemoryLeak(() => {
  runtime.worker.restart()
}, { threshold: 500 * 1024 * 1024, interval: 5000 })

runtime.on("degraded", () => {
  runtime.logger?.warn("Service degraded — attempting recovery")
})
```

### 4. Microservices Orchestrator

```ts
await runtime.boot()

// Spawn isolated processes as workers
await runtime.worker.spawn("./email-worker.ts", { count: 5 })
await runtime.worker.spawn("./image-processor.ts", { count: 3 })

// Listen for worker lifecycle events
runtime.workerLifecycle.on("crashed", ({ id }) => {
  runtime.logger?.error(`Worker ${id} crashed — auto-restarting`)
})

runtime.workerLifecycle.on("spawned", ({ id }) => {
  runtime.logger?.info(`Worker ${id} ready`)
})
```

## Real-World Example: Production API Service

A complete Bunova-powered HTTP API with auto-recovery, request tracking, and worker isolation:

```ts
import { runtime } from "bunova"

async function main() {
  await runtime.boot({
    logger: { level: "info" },
    telemetry: {
      memory: true,
      eventLoop: true,
      interval: 10000,       // snapshot every 10s
    },
    discovery: true,          // auto-detect routes and workers
    watch: true,              // reload on file changes
  })

  // Route-based worker isolation
  runtime.serve({
    port: Number(process.env.PORT) || 3000,
    fetch(req) {
      // Fallback handler — for unmatched routes
      return new Response("Not Found", { status: 404 })
    },
  })

  // Graceful shutdown
  runtime.on("shutdown", () => {
    runtime.logger?.info("Server shutting down")
  })

  // Health reporting
  setInterval(() => {
    const s = runtime.stats()
    const m = runtime.metrics.snapshot()
    runtime.logger?.info("Runtime health", {
      state: s.state,
      workers: s.workers,
      memory: m ? Math.round(m.memory.heapUsed / 1024 / 1024) + "MB" : "N/A",
      uptime: s.uptime + "ms",
    })
  }, 30000)
}

main().catch(console.error)
```

With route files in `src/routes/`:

```ts
// src/routes/users.ts — auto-discovered, isolated worker
export default {
  async fetch(req: Request) {
    const users = await db.query("SELECT * FROM users")
    return Response.json(users)
  }
}
```

## Customization Guide

### Custom Logger Transport

```ts
import { runtime } from "bunova"
import { FileTransport } from "@nds-stack/bun-logger"

runtime.boot({
  logger: {
    level: "debug",
    transports: [new FileTransport({ path: "./app.log" })],
  },
})
```

### Disable Auto Signals

```ts
runtime.boot({ signals: false })
// You handle signals yourself
```

### Custom Memory Watchdog Threshold

```ts
const watchdog = runtime.onMemoryLeak(() => {
  console.log("Memory breach detected!")
})
watchdog.stop() // Disable when not needed
```

## License

MIT
