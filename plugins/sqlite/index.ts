import { BunQL } from "@nds-stack/bunql"
import type { BunQLMetrics } from "@nds-stack/bunql"
import type { Plugin } from "bunova"

export interface SQLitePluginOptions {
  path: string
  label?: string
  interval?: number
}

export function sqlitePlugin(options: SQLitePluginOptions): Plugin {
  const label = options.label ?? "sqlite"
  const interval = options.interval ?? 5000

  return {
    name: label,
    version: "0.1.0",
    install(ctx) {
      const db = new BunQL(options.path)
      let timer: Timer | null = null

      ctx.on("shutdown", () => {
        if (timer) clearInterval(timer)
        db.close()
      })

      // Report initial state
      ctx.broadcast(`${label}:ready`, { path: options.path })

      // Periodic metrics
      timer = setInterval(() => {
        try {
          const metrics: BunQLMetrics = db.metrics()
          ctx.broadcast(`${label}:metrics`, {
            writes: metrics.writes,
            reads: metrics.reads,
            queue: metrics.queue,
          })
        } catch (err) {
          ctx.broadcast(`${label}:error`, { message: String(err) })
        }
      }, interval)
    },
  }
}
