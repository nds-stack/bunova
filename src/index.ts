import { Runtime } from "./runtime.ts"

export const runtime = new Runtime()

export { bootstrap } from "./bootstrap.ts"
export { BunServeMonitor } from "./monitoring/bun-monitor.ts"

export type { Runtime } from "./runtime.ts"
export type {
  LifecycleState,
  LifecycleEvent,
  LifecycleHandler,
  BootOptions,
  RuntimeStats,
  Plugin,
  PluginContext,
  PluginHandle,
  PluginUseOptions,
  TelemetryOptions,
  TelemetrySnapshot,
  WorkerOptions,
  WorkerHandle,
  WorkerPoolStats,
  MessageBusStats,
  ReloadOptions,
  ReloadStats,
  MemoryWatchdogOptions,
  MemoryWatchdogStats,
  BunServeMetrics,
  TraceSpan,
  TracerStats,
  BootstrapOptions,
  DiscoveryOptions,
  DiscoveryResult,
  MetricsAPI,
  WatchOptions,
  WatchdogOptions,
  LoggerStats,
  RouteDefinition,
  RouteRegistryStats,
} from "./types.ts"
