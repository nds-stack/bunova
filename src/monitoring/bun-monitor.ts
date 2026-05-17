import type { BunServeMetrics } from "../types.ts"

export class BunServeMonitor {
  #activeRequests = 0
  #totalRequests = 0
  #totalDurationMs = 0
  #statusCounts: Record<number, number> = {}

  get metrics(): BunServeMetrics {
    return {
      activeRequests: this.#activeRequests,
      totalRequests: this.#totalRequests,
      totalDurationMs: this.#totalDurationMs,
      avgDurationMs: this.#totalRequests > 0 ? this.#totalDurationMs / this.#totalRequests : 0,
      statusCounts: { ...this.#statusCounts },
    }
  }

  wrapFetch(fetch: (request: Request) => Response | Promise<Response>): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
      const start = performance.now()
      this.#activeRequests++
      this.#totalRequests++

      try {
        const response = await fetch(request)
        const duration = performance.now() - start
        this.#totalDurationMs += duration
        this.#activeRequests--
        this.#statusCounts[response.status] = (this.#statusCounts[response.status] ?? 0) + 1
        return response
      } catch (err) {
        const duration = performance.now() - start
        this.#totalDurationMs += duration
        this.#activeRequests--
        this.#statusCounts[500] = (this.#statusCounts[500] ?? 0) + 1
        throw err
      }
    }
  }

  reset(): void {
    this.#activeRequests = 0
    this.#totalRequests = 0
    this.#totalDurationMs = 0
    this.#statusCounts = {}
  }
}
