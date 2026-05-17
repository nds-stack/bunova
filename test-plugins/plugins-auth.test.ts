import { describe, expect, test } from "bun:test"
import { authPlugin } from "../plugins/auth/index.ts"

describe("@bunova/auth plugin", () => {
  test("verify returns null without secret", async () => {
    const plugin = authPlugin()
    let result: unknown
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { verify: (token: string) => Promise<unknown> }

    result = await api.verify("aaa.bbb.ccc")
    expect(result).toBeNull()
  })

  test("verify rejects malformed token", async () => {
    const plugin = authPlugin({ secret: "test-secret" })
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { verify: (token: string) => Promise<unknown> }

    expect(await api.verify("invalid")).toBeNull()
    expect(await api.verify("")).toBeNull()
    expect(await api.verify("a.b")).toBeNull()
  })

  test("verify rejects tampered token", async () => {
    const plugin = authPlugin({ secret: "super-secret" })
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { verify: (token: string) => Promise<unknown> }

    // Token with wrong signature
    const result = await api.verify("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.dGVzdC1wYXlsb2Fk.dGhpc2lzbm90YXZhbGlkc2lnbmF0dXJl")
    expect(result).toBeNull()
  })

  test("verify returns null when verifyToken returns null", async () => {
    const plugin = authPlugin({ verifyToken: async () => null })
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { verify: (token: string) => Promise<unknown> }

    const result = await api.verify("any.token.here")
    expect(result).toBeNull()
  })

  test("verify uses custom verifyToken if provided", async () => {
    const plugin = authPlugin({
      verifyToken: async (token) => ({ valid: true, user: { name: "test" } }),
    })
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { verify: (token: string) => Promise<unknown> }

    const result = await api.verify("x.y.z") as { valid: boolean; user: Record<string, unknown> }
    expect(result.valid).toBe(true)
    expect(result.user.name).toBe("test")
  })
})
