import type { PluginContext, LifecycleEvent, RouteDefinition } from "./types.ts"
import type { RuntimeCore } from "./runtime-core.ts"
import type { Lifecycle } from "./lifecycle.ts"

export function makePluginContext(core: RuntimeCore, lifecycle: Lifecycle): PluginContext {
  return {
    logger: core.logger ? {
      info: (msg, meta) => core.logger!.info(msg, meta),
      warn: (msg, meta) => core.logger!.warn(msg, meta),
      error: (msg, meta) => core.logger!.error(msg, meta),
    } : undefined,
    on: (event, handler) => lifecycle.on(event, handler),
    broadcast: (channel, payload) => core.bus.publish(channel, payload),
  }
}

export function emitLifecycle(core: RuntimeCore, event: LifecycleEvent, ...args: unknown[]): void {
  core.lifecycle.emit(event, ...args).catch((err) => {
    core.lifecycle.crash(err instanceof Error ? err : new Error(String(err)))
  })
}

export function inferPattern(routePath: string): string {
  const parts = routePath.replace(/\\/g, "/").split("/")
  const name = parts.pop()?.replace(/\.(ts|js)$/, "") ?? ""
  if (name === "index") return "/"

  // If route is in a subdirectory, use directory as prefix
  // e.g., "src/routes/api/users.ts" → "/api/users/*"
  // e.g., "src/routes/users.ts" → "/users/*"
  const routesIdx = parts.indexOf("routes")
  if (routesIdx >= 0 && routesIdx < parts.length - 1) {
    const subdirs = parts.slice(routesIdx + 1)
    return `/${subdirs.join("/")}/${name}/*`
  }
  return `/${name}/*`
}

export function groupRoutesByDir(routes: RouteDefinition[]): Map<string, RouteDefinition[]> {
  const groups = new Map<string, RouteDefinition[]>()

  for (const route of routes) {
    const parts = route.path.replace(/\\/g, "/").split("/")
    const routesIdx = parts.indexOf("routes")

    // Determine group key: directory path or "standalone" for root-level routes
    let key: string
    if (routesIdx >= 0 && routesIdx < parts.length - 2) {
      // Route in subdirectory — group by the directory name
      key = parts.slice(routesIdx + 1, -1).join("/")
    } else {
      // Route in root of src/routes/ — standalone
      key = `_standalone_${route.pattern}`
    }

    const group = groups.get(key) || []
    group.push(route)
    groups.set(key, group)
  }

  return groups
}
