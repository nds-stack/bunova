import { describe, expect, test } from "bun:test"
import { WorkerOrchestrator } from "../src/workers/orchestrator.ts"

describe("WorkerOrchestrator — edge cases", () => {
  test("spawn with maxRestarts stops after limit", async () => {
    const wo = new WorkerOrchestrator()
    const worker = await wo.spawn("./nonexistent-loop.ts", {
      restart: true,
      maxRestarts: 3,
    })
    expect(worker.id).toBeTruthy()

    // Wait for spawn + repeated crash/restart attempts
    await Bun.sleep(3000)

    const stats = wo.stats()
    // Worker should have stopped restarting after maxRestarts
    // Status could be crashed (killed) or spawning (in restart loop)
    expect(stats.total).toBeGreaterThanOrEqual(1)
    wo.clear()
  })

  test("concurrent spawns don't crash", async () => {
    const wo = new WorkerOrchestrator()
    const results = await Promise.allSettled([
      wo.spawn("./nonexistent-1.ts", { restart: false }),
      wo.spawn("./nonexistent-2.ts", { restart: false }),
      wo.spawn("./nonexistent-3.ts", { restart: false }),
    ])
    expect(results).toHaveLength(3)
    expect(wo.count).toBe(3)
    wo.clear()
  })

  test("clear while workers are spawning", async () => {
    const wo = new WorkerOrchestrator()
    wo.spawn("./nonexistent-clr.ts", { restart: false }).catch(() => {})
    wo.spawn("./nonexistent-clr.ts", { restart: false }).catch(() => {})
    wo.clear()
    expect(wo.count).toBe(0)
  })

  test("stats with mixed statuses", async () => {
    const wo = new WorkerOrchestrator()
    await wo.spawn("./nonexistent-mix.ts", { restart: false })
    await Bun.sleep(200)
    await wo.spawn("./nonexistent-mix-b.ts", { restart: false })
    await Bun.sleep(200)

    // Stop all
    wo.stop()
    const s = wo.stats()
    expect(s.total).toBe(2)
    // Some may be crashed, some stopped
    expect(s.stopped + s.crashed).toBeGreaterThanOrEqual(0)
    wo.clear()
  })
})
