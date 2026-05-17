import type { LifecycleState, LifecycleEvent, LifecycleHandler } from "./types.ts"

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  "init":             ["booting"],
  "booting":          ["plugin-init", "crashed"],
  "plugin-init":      ["starting-server", "crashed"],
  "starting-server":  ["ready", "crashed"],
  "ready":            ["running", "shutting-down", "crashed"],
  "running":          ["degraded", "shutting-down", "crashed"],
  "degraded":         ["recovering", "shutting-down", "crashed"],
  "recovering":       ["running", "crashed"],
  "shutting-down":    ["init", "crashed"],
  "crashed":          [],
}

export class Lifecycle {
  #state: LifecycleState = "init"
  #handlers = new Map<LifecycleEvent, Set<LifecycleHandler>>()

  get state(): LifecycleState {
    return this.#state
  }

  on(event: LifecycleEvent, handler: LifecycleHandler): void {
    let set = this.#handlers.get(event)
    if (!set) {
      set = new Set()
      this.#handlers.set(event, set)
    }
    set.add(handler)
  }

  off(event: LifecycleEvent, handler: LifecycleHandler): void {
    const set = this.#handlers.get(event)
    if (set) {
      set.delete(handler)
    }
  }

  once(event: LifecycleEvent, handler: LifecycleHandler): void {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper)
      return handler(...args)
    }
    this.on(event, wrapper)
  }

  transition(to: LifecycleState): void {
    const from = this.#state
    const allowed = VALID_TRANSITIONS[from]
    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid lifecycle transition: ${from} -> ${to}. Allowed: ${allowed.join(", ")}`
      )
    }
    this.#state = to
  }

  async emit(event: LifecycleEvent, ...args: unknown[]): Promise<void> {
    const set = this.#handlers.get(event)
    if (!set) return
    const errors: Error[] = []
    for (const handler of set) {
      try {
        const result = handler(...args)
        if (result instanceof Promise) {
          await result
        }
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)))
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, `Lifecycle event "${event}" had ${errors.length} handler error(s)`)
    }
  }

  crash(err: Error): void {
    if (this.#state === "crashed") return
    this.transition("crashed")
    this.emit("crash", err).catch(() => {})
  }

  async emitAndCrash(event: LifecycleEvent, err: Error): Promise<void> {
    try {
      await this.emit(event, err)
    } catch {
      // emit errors absorbed by crash transition
    }
    this.crash(err)
  }

  reset(): void {
    this.#state = "init"
    this.#handlers.clear()
  }
}
