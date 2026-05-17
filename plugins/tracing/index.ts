import type { Plugin, BootOptions } from "bunova"

export interface TracingOptions {
  label?: string
  endpoint?: string
  serviceName?: string
}

export function tracingPlugin(options: TracingOptions = {}): Plugin {
  const label = options.label ?? "tracing"
  const endpoint = options.endpoint
  const serviceName = options.serviceName ?? "bunova-app"

  return {
    name: label,
    version: "0.1.0",
    install(ctx) {
      const spans: Array<{ id: string; name: string; duration: number; metadata?: Record<string, unknown> }> = []
      let timer: Timer | null = null

      ctx.on("shutdown", () => {
        if (timer) clearInterval(timer)
        flush()
      })

      function flush() {
        if (spans.length === 0) return
        const batch = spans.splice(0)

        ctx.broadcast(`${label}:spans`, { service: serviceName, spans: batch })

        if (endpoint) {
          fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service: serviceName, spans: batch }),
          }).catch(() => {})
        }
      }

      timer = setInterval(flush, 5000)

      return {
        record: (name: string, duration: number, metadata?: Record<string, unknown>) => {
          spans.push({ id: crypto.randomUUID(), name, duration, metadata })
        },
        flush,
      }
    },
  }
}
