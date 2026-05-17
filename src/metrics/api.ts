import type { MetricsAPI } from "../types.ts"
import type { TelemetryEngine } from "../telemetry/engine.ts"
import type { BunServeMonitor } from "../monitoring/bun-monitor.ts"

export function createMetricsAPI(
  telemetry: TelemetryEngine | undefined,
  serveMonitor: BunServeMonitor | undefined,
): MetricsAPI {
  return {
    memory() {
      if (!telemetry) return { heapUsed: 0, heapTotal: 0, rss: 0, external: 0, arrayBuffers: 0 }
      return telemetry.memory()
    },
    eventLoop() {
      if (!telemetry) return { lag: 0 }
      return telemetry.eventLoop()
    },
    snapshot() {
      if (!telemetry) return { memory: { heapUsed: 0, heapTotal: 0, rss: 0, external: 0, arrayBuffers: 0 }, eventLoop: { lag: 0 }, uptime: 0, timestamp: new Date().toISOString() }
      return telemetry.snapshot()
    },
    cpu() {
      if (!telemetry) return { user: 0, system: 0 }
      return telemetry.cpu()
    },
    serve() {
      if (!serveMonitor) return null
      return serveMonitor.metrics
    },
  }
}
