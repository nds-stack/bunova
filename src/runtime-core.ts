import { Lifecycle } from "./lifecycle.ts"
import { WorkerLifecycle } from "./lifecycle/worker-lifecycle.ts"
import { PluginLifecycle } from "./lifecycle/plugin-lifecycle.ts"
import { RouteLifecycle } from "./lifecycle/route-lifecycle.ts"
import { PluginManager } from "./plugins/manager.ts"
import { MessageBus } from "./bus/message-bus.ts"
import { Tracer } from "./monitoring/tracer.ts"
import { ObservabilityManager } from "./managers/observability-manager.ts"
import { OrchestrationManager } from "./managers/orchestration-manager.ts"
import { RoutingManager } from "./managers/routing-manager.ts"
import { ReloadManager } from "./managers/reload-manager.ts"
import type { BunLogger } from "@nds-stack/bun-logger"

export class RuntimeCore {
  readonly lifecycle = new Lifecycle()
  readonly bus = new MessageBus()
  readonly workerLifecycle = new WorkerLifecycle(this.bus)
  readonly pluginLifecycle = new PluginLifecycle(this.bus)
  readonly routeLifecycle = new RouteLifecycle(this.bus)
  readonly plugins = new PluginManager()
  readonly tracer = new Tracer()
  observability = ObservabilityManager.createEmpty()
  orchestration = OrchestrationManager.create()
  readonly routing = new RoutingManager()
  readonly reload = new ReloadManager()

  testing = false
  startedAt: string | null = null
  booted = false
  logger: BunLogger | undefined
}
