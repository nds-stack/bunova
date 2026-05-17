import type { Plugin } from "bunova"

export interface RedisPluginOptions {
  /** Redis connection URL, e.g. redis://localhost:6379 */
  url: string
  label?: string
  interval?: number
  /** Custom Redis client import path. Default: "ioredis" */
  clientPackage?: string
}

export function redisPlugin(options: RedisPluginOptions): Plugin {
  const label = options.label ?? "redis"
  const interval = options.interval ?? 5000

  return {
    name: label,
    version: "0.1.0",
    async install(ctx) {
      let client: { on: (e: string, cb: (...args: unknown[]) => void) => void; status: string; quit: () => Promise<void> }
      let timer: Timer | null = null

      try {
        const mod = await import(options.clientPackage ?? "ioredis")
        const Redis = mod.default as new (url: string) => typeof client
        client = new Redis(options.url)

        client.on("error", (err: Error) => {
          ctx.broadcast(`${label}:error`, { message: err.message })
        })

        ctx.on("shutdown", async () => {
          if (timer) clearInterval(timer)
          await client.quit()
        })
      } catch (err) {
        ctx.broadcast(`${label}:error`, { message: `Failed to connect: ${err}` })
        return
      }

      ctx.broadcast(`${label}:ready`, { url: options.url })

      timer = setInterval(() => {
        ctx.broadcast(`${label}:metrics`, {
          status: client.status,
        })
      }, interval)
    },
  }
}
