import type { Plugin } from "bunova"

export interface WSOptions {
  label?: string
  interval?: number
}

export function wsPlugin(options: WSOptions = {}): Plugin {
  const label = options.label ?? "ws"
  const interval = options.interval ?? 5000

  return {
    name: label,
    version: "0.1.0",
    install(ctx) {
      let connections = 0
      let messages = 0
      let errors = 0
      let timer: Timer | null = null

      ctx.on("shutdown", () => {
        if (timer) clearInterval(timer)
      })

      timer = setInterval(() => {
        ctx.broadcast(`${label}:metrics`, { connections, messages, errors })
      }, interval)

      return {
        trackOpen: () => { connections++ },
        trackMessage: () => { messages++ },
        trackError: () => { errors++ },
        trackClose: () => { connections-- },
      }
    },
  }
}
