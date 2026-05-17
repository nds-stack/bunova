import { RouteRegistry } from "./registry.ts"

export class RouteProxy {
  #registry: RouteRegistry
  #fallback: ((request: Request) => Response | Promise<Response>) | null = null
  #portMap = new Map<string, number>()

  constructor(registry: RouteRegistry) {
    this.#registry = registry
  }

  syncPortMap(): void {
    this.#portMap.clear()
    for (const route of this.#registry.list) {
      if (route.port) this.#portMap.set(route.pattern, route.port)
    }
  }

  setFallback(fn: (request: Request) => Response | Promise<Response>): void {
    this.#fallback = fn
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    for (const route of this.#registry.list) {
      if (this.#match(route.pattern, path)) {
        const port = route.port ?? this.#portMap.get(route.pattern)
        if (!port) continue
        return this.#proxyToWorker(port, request)
      }
    }

    if (this.#fallback) {
      return this.#fallback(request)
    }

    return new Response("Not Found", { status: 404 })
  }

  #match(pattern: string, path: string): boolean {
    if (pattern === "/*") return true
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2)
      return path.startsWith(prefix)
    }
    if (pattern.endsWith("/")) {
      return path.startsWith(pattern)
    }
    return path === pattern
  }

  async #proxyToWorker(port: number, request: Request): Promise<Response> {
    const url = new URL(request.url)
    try {
      // Forwards ALL request headers to the route worker, including Authorization.
      // In production, consider stripping or validating sensitive headers
      // if the route worker runs in a less trusted context.
      const response = await fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
      })
      return response
    } catch {
      return new Response("Route Worker Unavailable", { status: 503 })
    }
  }
}
