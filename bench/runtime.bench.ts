#!/usr/bin/env bun
import { Runtime } from "../src/runtime.ts"

console.log("--- Bunova Runtime Benchmark ---")
console.log(`Bun ${Bun.version}\n`)

function measure(label: string, iterations: number, fn: () => void): void {
  // warmup
  fn()

  const start = performance.now()
  fn()
  const elapsed = performance.now() - start

  const opsPerSec = elapsed > 0 ? Math.round(iterations / (elapsed / 1000)) : 0
  const perOp = elapsed / iterations

  const opsStr = opsPerSec > 1_000_000
    ? `${(opsPerSec / 1_000_000).toFixed(1)}M ops/s`
    : opsPerSec > 1_000
      ? `${(opsPerSec / 1_000).toFixed(0)}K ops/s`
      : `${opsPerSec} ops/s`

  const perOpStr = perOp > 1
    ? `${perOp.toFixed(2)} ms`
    : perOp > 0.001
      ? `${(perOp * 1000).toFixed(2)} µs`
      : `${(perOp * 1_000_000).toFixed(2)} ns`

  console.log(`${label.padEnd(30)} ${opsStr.padStart(14)}  ${perOpStr.padStart(12)}/op`)
}

// Cold boot
measure("runtime boot (cold)", 1, () => {
  new Runtime().boot({ signals: false })
})

const r = new Runtime()
r.boot({ signals: false })

// State check
measure("state check", 10_000, () => {
  for (let i = 0; i < 10_000; i++) void r.state
})

// stats()
measure("stats()", 10_000, () => {
  for (let i = 0; i < 10_000; i++) r.stats()
})

// on/off
measure("on/off cycle", 10_000, () => {
  const handler = () => {}
  for (let i = 0; i < 10_000; i++) {
    r.on("ready", handler)
    r.off("ready", handler)
  }
})

// memory access
measure("memory access (uptime)", 10_000, () => {
  for (let i = 0; i < 10_000; i++) void r.uptime
})

// onMemoryLeak
measure("onMemoryLeak + stop", 1_000, () => {
  for (let i = 0; i < 1_000; i++) {
    const w = r.onMemoryLeak(() => {})
    w.stop()
  }
})

console.log("")
console.log("Note: Cold boot is a single operation. Loop-based ops measure amortized cost.")
