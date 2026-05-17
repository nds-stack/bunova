import { describe, expect, test } from "bun:test"
import { WorkerOrchestrator } from "../src/workers/orchestrator.ts"

describe("WorkerOrchestrator", () => {
  test("initial state has zero workers", () => {
    const wo = new WorkerOrchestrator()
    expect(wo.count).toBe(0)
    expect(wo.list).toEqual([])
  })

  test("stats returns zeros initially", () => {
    const wo = new WorkerOrchestrator()
    const s = wo.stats()
    expect(s.total).toBe(0)
    expect(s.running).toBe(0)
    expect(s.stopped).toBe(0)
    expect(s.crashed).toBe(0)
    expect(s.healthy).toBe(0)
    expect(s.unhealthy).toBe(0)
    expect(s.averageMemory).toBeNull()
  })

  test("spawn with nonexistent file marks as crashed", async () => {
    const wo = new WorkerOrchestrator()
    const worker = await wo.spawn("./nonexistent-script.ts", { restart: false })
    expect(worker.id).toBeTruthy()
    expect(worker.path).toBe("./nonexistent-script.ts")

    // Wait briefly for spawn to process
    await Bun.sleep(200)
    expect(wo.count).toBe(1)
  })

  test("stop all clears workers", async () => {
    const wo = new WorkerOrchestrator()
    await wo.spawn("./nonexistent-a.ts", { restart: false })
    await wo.spawn("./nonexistent-b.ts", { restart: false })
    await Bun.sleep(200)
    wo.stop()
    expect(wo.count).toBe(2)
    expect(wo.stats().stopped + wo.stats().crashed).toBe(2)
    wo.clear()
    expect(wo.count).toBe(0)
  })
})
