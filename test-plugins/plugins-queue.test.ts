import { describe, expect, test } from "bun:test"
import { queuePlugin } from "../plugins/queue/index.ts"
import type { Job } from "../plugins/queue/index.ts"

describe("@bunova/queue plugin", () => {
  test("enqueue creates a job", () => {
    const plugin = queuePlugin()
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { enqueue: (type: string, payload: unknown) => Job }

    const job = api.enqueue("email", { to: "test@test.com" })
    expect(job.id).toBeDefined()
    expect(job.type).toBe("email")
    expect(job.status).toBe("pending")
    expect(job.retries).toBe(0)
    expect(job.maxRetries).toBe(3)
  })

  test("enqueue with different types", () => {
    const plugin = queuePlugin()
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { enqueue: (type: string, payload: unknown) => Job }

    const j1 = api.enqueue("email", { to: "a@b.com" })
    const j2 = api.enqueue("sms", { phone: "+123" })
    expect(j1.type).toBe("email")
    expect(j2.type).toBe("sms")
  })

  test("process handler executes pending jobs", async () => {
    const plugin = queuePlugin()
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { enqueue: (type: string, payload: unknown) => Job; process: (handler: (job: Job) => Promise<void>) => Promise<void> }

    api.enqueue("task", { data: 1 })
    let processed: Job | null = null
    await api.process(async (job) => {
      processed = job
    })
    expect(processed).not.toBeNull()
    expect(processed!.type).toBe("task")
  })

  test("stats returns counts", async () => {
    const plugin = queuePlugin()
    const api = plugin.install!({
      logger: undefined,
      on: () => {},
      broadcast: () => {},
    }) as { enqueue: (type: string, payload: unknown) => Job; process: (handler: (job: Job) => Promise<void>) => Promise<void>; stats: () => Promise<Record<string, number>> }

    api.enqueue("a", {})
    api.enqueue("b", {})
    const s = await api.stats()
    expect(s.pending).toBeGreaterThanOrEqual(2)
  })
})
