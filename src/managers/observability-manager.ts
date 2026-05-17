import type { TelemetryOptions, MetricsAPI, WatchdogOptions } from "../types.ts"
import { TelemetryEngine } from "../telemetry/engine.ts"
import { MemoryWatchdog } from "../monitoring/memory-watchdog.ts"
import { Tracer } from "../monitoring/tracer.ts"
import { BunServeMonitor } from "../monitoring/bun-monitor.ts"
import { createMetricsAPI } from "../metrics/api.ts"

export class ObservabilityManager {
  readonly telemetry: TelemetryEngine | undefined
  readonly tracer = new Tracer()
  readonly serveMonitor: BunServeMonitor | undefined

  #watchdog: MemoryWatchdog | undefined
  #metrics: MetricsAPI | undefined

  private constructor(telemetry?: TelemetryEngine, serveMonitor?: BunServeMonitor) {
    this.telemetry = telemetry
    this.serveMonitor = serveMonitor
  }

  static create(options?: TelemetryOptions | boolean): ObservabilityManager {
    let telemetry: TelemetryEngine | undefined
    if (options !== undefined && options !== false) {
      const opts = typeof options === "boolean" ? {} : options
      telemetry = new TelemetryEngine(opts)
      telemetry.start()
    }
    const serveMonitor = new BunServeMonitor()
    return new ObservabilityManager(telemetry, serveMonitor)
  }

  static createEmpty(): ObservabilityManager {
    return new ObservabilityManager(undefined, new BunServeMonitor())
  }

  get metrics() {
    if (!this.#metrics) {
      this.#metrics = createMetricsAPI(this.telemetry, this.serveMonitor)
    }
    return this.#metrics
  }

  get watchdog(): MemoryWatchdog | undefined {
    return this.#watchdog
  }

  onMemoryLeak(handler: () => void | Promise<void>, options?: WatchdogOptions): MemoryWatchdog {
    this.#watchdog?.stop()
    const watchdog = new MemoryWatchdog({
      threshold: options?.threshold ?? 200 * 1024 * 1024,
      interval: options?.interval ?? 10000,
      callback: handler,
    })
    this.#watchdog = watchdog
    watchdog.start()
    return watchdog
  }

  wrapFetch(fetch: (request: Request) => Response | Promise<Response>): (request: Request) => Promise<Response> {
    if (!this.serveMonitor) {
      return async (req) => fetch(req)
    }
    return this.serveMonitor.wrapFetch(fetch)
  }

  stop(): void {
    this.telemetry?.stop()
    this.#watchdog?.stop()
  }
}
