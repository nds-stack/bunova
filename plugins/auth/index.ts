import type { Plugin } from "bunova"

export interface AuthOptions {
  label?: string
  secret?: string
  verifyToken?: (token: string) => Promise<{ valid: boolean; user?: Record<string, unknown> } | null>
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  while (base64.length % 4) base64 += "="
  return atob(base64)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export function authPlugin(options: AuthOptions = {}): Plugin {
  const label = options.label ?? "auth"

  return {
    name: label,
    version: "0.1.0",
    install(ctx) {
      ctx.on("ready", () => {
        ctx.broadcast(`${label}:ready`, {})
      })

      return {
        verify: async (token: string) => {
          if (options.verifyToken) {
            return options.verifyToken(token)
          }

          if (!options.secret) return null
          try {
            const parts = token.split(".")
            if (parts.length !== 3) return null
            const [header, payload, signature] = parts

            const data = `${header}.${payload}`
            const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(options.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
            const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)))
            const given = hexToBytes(signature)

            if (expected.length !== given.length) return null
            if (!crypto.subtle.timingSafeEqual(expected.buffer, given.buffer)) return null

            return { valid: true, user: JSON.parse(new TextDecoder().decode(Uint8Array.from(base64urlDecode(payload), c => c.charCodeAt(0)))) }
          } catch {
            return null
          }
        },
      }
    },
  }
}
