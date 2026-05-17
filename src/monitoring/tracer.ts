import type { TraceSpan, TracerStats } from "../types.ts"

let nextId = 0

export class Tracer {
  #spans = new Map<string, TraceSpan>()
  #completedCount = 0

  get stats(): TracerStats {
    return {
      spansStarted: this.#spans.size + this.#completedCount,
      spansCompleted: this.#completedCount,
      activeSpans: this.#spans.size,
    }
  }

  start(name: string, parentId?: string, metadata?: Record<string, unknown>): string {
    const id = `trace-${++nextId}`
    const span: TraceSpan = {
      id,
      parentId,
      name,
      startTime: performance.now(),
      metadata,
    }
    this.#spans.set(id, span)
    return id
  }

  end(id: string): TraceSpan | null {
    const span = this.#spans.get(id)
    if (!span) return null

    span.endTime = performance.now()
    span.duration = span.endTime - span.startTime
    this.#spans.delete(id)
    this.#completedCount++
    return span
  }

  clear(): void {
    this.#spans.clear()
    this.#completedCount = 0
  }
}
