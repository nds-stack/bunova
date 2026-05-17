import { describe, expect, test } from "bun:test"
import { bootstrap } from "../src/bootstrap.ts"

describe("bootstrap", () => {
  test("bootstrap is a function", () => {
    expect(typeof bootstrap).toBe("function")
  })

  test("bootstrap accepts entry point and options", () => {
    // Can't actually run bootstrap in tests (it spawns processes)
    // but we can verify the function signature exists
    // bootstrap(entryPoint, options?) — options has defaults
    expect(bootstrap.length).toBe(1)
  })
})
