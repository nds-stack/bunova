import { RouteRegistry } from "../routes/registry.ts"
import { RouteProxy } from "../routes/proxy.ts"
import type { RouteDefinition, RouteRegistryStats } from "../types.ts"

export class RoutingManager {
  readonly registry = new RouteRegistry()
  readonly proxy = new RouteProxy(this.registry)

  async register(definition: RouteDefinition): Promise<void> {
    await this.registry.register(definition)
    this.proxy.syncPortMap()
  }

  async registerGroup(key: string, definitions: RouteDefinition[]): Promise<void> {
    await this.registry.registerGroup(key, definitions)
    this.proxy.syncPortMap()
  }

  unregister(pattern: string): void {
    this.registry.unregister(pattern)
    this.proxy.syncPortMap()
  }

  clear(): void {
    this.registry.clear()
    this.proxy.syncPortMap()
  }

  handle(request: Request): Promise<Response> {
    return this.proxy.handle(request)
  }

  setFallback(fn: (request: Request) => Response | Promise<Response>): void {
    this.proxy.setFallback(fn)
  }

  get list(): RouteDefinition[] {
    return this.registry.list
  }

  get stats(): RouteRegistryStats {
    return this.registry.stats
  }
}
