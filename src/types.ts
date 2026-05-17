import type { BunLoggerOptions } from "@nds-stack/bun-logger"
import type { EnvSchema } from "@nds-stack/bun-env"

// ── Lifecycle ──────────────────────────────────────────

export type LifecycleState =
  | "init"
  | "booting"
  | "plugin-init"
  | "starting-server"
  | "ready"
  | "running"
  | "degraded"
  | "recovering"
  | "shutting-down"
  | "crashed"

export type LifecycleEvent =
  | "boot"
  | "plugin-init"
  | "starting-server"
  | "ready"
  | "running"
  | "degraded"
  | "recovering"
  | "shutdown"
  | "crash"
  | "error"

export type LifecycleHandler = (...args: unknown[]) => void | Promise<void>

// ── Boot ───────────────────────────────────────────────

export interface BootOptions {
  logger?: BunLoggerOptions
  env?: {
    schema: EnvSchema
  }
  signals?: boolean
  telemetry?: boolean | TelemetryOptions
  plugins?: Plugin[]
  discovery?: boolean
  watch?: boolean | WatchOptions
}

export interface WatchOptions {
  dirs?: string[]
}

export interface WatchdogOptions {
  threshold?: number
  interval?: number
}

// ── Telemetry ──────────────────────────────────────────

export interface TelemetryOptions {
  interval?: number
  memory?: boolean
  eventLoop?: boolean
  cpu?: boolean
  history?: number
}

export interface TelemetrySnapshot {
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external: number
    arrayBuffers: number
  }
  eventLoop: {
    lag: number
  }
  cpu?: {
    user: number
    system: number
  }
  uptime: number
  timestamp: string
}

// ── Runtime Stats ──────────────────────────────────────

export interface RuntimeStats {
  state: LifecycleState
  uptime: number
  startedAt: string | null
  workers: number
  plugins: number
  telemetry: boolean
  watchEnabled: boolean
  discoveryEnabled: boolean
}

// ── Plugins ────────────────────────────────────────────

export interface Plugin {
  name: string
  version?: string
  install?: (ctx: PluginContext) => void | Promise<void>
  uninstall?: (ctx: PluginContext) => void | Promise<void>
}

export interface PluginContext {
  logger: PluginLogger | undefined
  on: (event: LifecycleEvent, handler: LifecycleHandler) => void
  broadcast: (channel: string, payload?: unknown) => void
}

export interface PluginLogger {
  info: (message: string, meta?: unknown) => void
  warn: (message: string, meta?: unknown) => void
  error: (message: string, meta?: unknown) => void
}

export interface LoggerStats {
  written: number
  dropped: number
  transports: number
  level: string
}

export interface PluginHandle {
  name: string
  version: string
  installed: boolean
  installedAt: string | null
  isolated: boolean
}

export interface PluginUseOptions {
  isolate?: boolean
}

// ── Workers ────────────────────────────────────────────

export interface WorkerOptions {
  count?: number
  restart?: boolean
  maxRestarts?: number
  healthcheck?: {
    interval: number
    timeout?: number
  }
  recycle?: {
    maxMemory?: number
    maxRequests?: number
  }
  env?: Record<string, string>
}

export interface WorkerHandle {
  id: string
  path: string
  pid: number | null
  status: "spawning" | "running" | "stopped" | "crashed"
  startedAt: string | null
  restarts: number
  requests: number
  memory: number | null
  healthStatus: "unknown" | "healthy" | "unhealthy"
}

export interface WorkerPoolStats {
  total: number
  running: number
  stopped: number
  crashed: number
  healthy: number
  unhealthy: number
  averageMemory: number | null
}

// ── Message Bus ────────────────────────────────────────

export interface MessageBusStats {
  channels: number
  subscribers: number
  messagesSent: number
}

// ── Reload ─────────────────────────────────────────────

export interface ReloadOptions {
  target?: "workers" | "plugins" | "all"
  graceful?: boolean
}

export interface ReloadStats {
  lastReload: string | null
  reloadCount: number
  watchEnabled: boolean
  watchedFiles: number
}

// ── Monitoring ─────────────────────────────────────────

export interface MemoryWatchdogOptions {
  threshold: number
  interval: number
  callback?: () => void | Promise<void>
}

export interface MemoryWatchdogStats {
  threshold: number
  currentUsage: number
  breaches: number
  lastBreach: string | null
  active: boolean
}

export interface BunServeMetrics {
  activeRequests: number
  totalRequests: number
  totalDurationMs: number
  avgDurationMs: number
  statusCounts: Record<number, number>
}

// ── Tracing ────────────────────────────────────────────

export interface TraceSpan {
  id: string
  parentId?: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, unknown>
}

export interface TracerStats {
  spansStarted: number
  spansCompleted: number
  activeSpans: number
}

// ── Bootstrap ──────────────────────────────────────────

export interface BootstrapOptions {
  restart?: boolean
  restartDelay?: number
  maxRestarts?: number
  env?: Record<string, string>
}

// ── Discovery ──────────────────────────────────────────

export interface DiscoveryOptions {
  pluginsDir?: string
  workersDir?: string
  routesDir?: string
}

export interface DiscoveryResult {
  plugins: string[]
  workers: string[]
  routes: string[]
}

// ── Metrics ────────────────────────────────────────────

export interface MetricsAPI {
  memory(): { heapUsed: number; heapTotal: number; rss: number; external: number; arrayBuffers: number }
  eventLoop(): { lag: number }
  snapshot(): TelemetrySnapshot
  cpu(): { user: number; system: number }
  serve(): BunServeMetrics | null
}

// ── Routes ─────────────────────────────────────────────

export interface RouteDefinition {
  pattern: string
  path: string
  port?: number
}

export interface RouteRegistryStats {
  total: number
  running: number
  patterns: string[]
}
