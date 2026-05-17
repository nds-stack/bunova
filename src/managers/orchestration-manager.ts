import type { DiscoveryResult } from "../types.ts"
import { WorkerOrchestrator } from "../workers/orchestrator.ts"
import { DiscoveryEngine } from "../discovery/engine.ts"
import type { BunLogger } from "@nds-stack/bun-logger"

export class OrchestrationManager {
  readonly workers = new WorkerOrchestrator()
  readonly discovery: DiscoveryEngine | undefined

  #logger: BunLogger | undefined

  private constructor(discovery?: DiscoveryEngine) {
    this.discovery = discovery
  }

  static create(discoveryEnabled?: boolean): OrchestrationManager {
    const discovery = discoveryEnabled ? new DiscoveryEngine() : undefined
    return new OrchestrationManager(discovery)
  }

  setLogger(logger: BunLogger | undefined): void {
    this.#logger = logger
  }

  async autoDiscover(): Promise<DiscoveryResult | null> {
    if (!this.discovery) return null
    try {
      const result = await this.discovery.scan()
      for (const workerPath of result.workers) {
        this.workers.spawn(workerPath).then(() => {
          this.#logger?.info(`Worker spawned: ${workerPath}`)
        }).catch((err) => {
          this.#logger?.error(`Failed to spawn worker: ${workerPath}`, err)
        })
      }
      return result
    } catch (err) {
      this.#logger?.warn("Auto-discovery failed", err)
      return null
    }
  }

  stopAll(): void {
    this.workers.clear()
  }
}
