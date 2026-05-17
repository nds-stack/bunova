import { writeStdout } from "../ipc/message-stream.ts"

interface RouteModule {
  default: {
    pattern?: string
    port?: number
    fetch: (request: Request) => Response | Promise<Response>
  }
}

interface GroupRoute {
  path: string
  pattern: string
}

const port = Number(process.env.BUNOVA_ROUTE_PORT) || 0
const routePath = process.env.BUNOVA_ROUTE_PATH ?? ""
const routePattern = process.env.BUNOVA_ROUTE_PATTERN ?? "/*"
const routeGroupJson = process.env.BUNOVA_ROUTE_GROUP ?? ""

interface RouteEntry {
  pattern: string
  fetch: (req: Request) => Response | Promise<Response>
}

async function loadRoute(path: string): Promise<RouteEntry | null> {
  try {
    const mod: RouteModule = await import(path)
    const route = mod.default
    if (!route?.fetch) return null
    return { pattern: route.pattern ?? "/*", fetch: route.fetch }
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const routes: Array<{ pattern: string; fetch: (req: Request) => Response | Promise<Response> }> = []

  if (routeGroupJson) {
    // Grouped mode: load multiple routes
    let group: GroupRoute[] = []
    try { group = JSON.parse(routeGroupJson) } catch { /* invalid JSON */ }

    for (const gr of group) {
      const entry = await loadRoute(gr.path)
      if (entry) {
        routes.push({ pattern: gr.pattern, fetch: entry.fetch })
      }
    }

    if (routes.length === 0) {
      process.stderr.write("No valid routes found in group\n")
      process.exit(1)
      return
    }
  } else if (routePath) {
    // Single mode (backward compat)
    const entry = await loadRoute(routePath)
    if (!entry) {
      process.stderr.write(`Route "${routePath}" missing or invalid\n`)
      process.exit(1)
      return
    }
    routes.push({ pattern: routePattern, fetch: entry.fetch })
  } else {
    process.stderr.write("Missing route configuration\n")
    process.exit(1)
    return
  }

  writeStdout({ type: "starting", port, routeCount: routes.length })

  Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url)
      // Find first matching route by pattern
      for (const r of routes) {
        if (matchPattern(r.pattern, url.pathname)) {
          return r.fetch(request)
        }
      }
      return new Response("Not Found", { status: 404 })
    },
  })

  writeStdout({ type: "ready", port, patterns: routes.map(r => r.pattern) })

  // Stay alive (skip in test mode — BUNOVA_TESTING prevents keeping process alive)
  let keepAliveTimer: Timer | null = null
  if (!process.env.BUNOVA_TESTING) {
    keepAliveTimer = setInterval(() => {}, 60_000)
    process.on("beforeExit", () => {
      if (keepAliveTimer) clearInterval(keepAliveTimer)
    })
  }
}

function matchPattern(pattern: string, path: string): boolean {
  if (pattern === "/*") return true
  if (pattern.endsWith("/*")) {
    return path.startsWith(pattern.slice(0, -2))
  }
  if (pattern.endsWith("/")) {
    return path.startsWith(pattern)
  }
  return path === pattern
}

main()
