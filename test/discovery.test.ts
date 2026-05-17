import { describe, expect, test } from "bun:test"
import { DiscoveryEngine } from "../src/discovery/engine.ts"

describe("DiscoveryEngine", () => {
  test("scan returns empty for nonexistent dirs", async () => {
    const de = new DiscoveryEngine({
      pluginsDir: "nonexistent-plugins",
      workersDir: "nonexistent-workers",
    })
    const result = await de.scan()
    expect(result.plugins).toEqual([])
    expect(result.workers).toEqual([])
  })
})
