import type { DiscoveryOptions, DiscoveryResult } from "../types.ts"

const DEFAULT_PLUGINS_DIR = "src/plugins"
const DEFAULT_WORKERS_DIR = "src/workers"
const DEFAULT_ROUTES_DIR = "src/routes"

export class DiscoveryEngine {
  #pluginsDir: string
  #workersDir: string
  #routesDir: string

  constructor(options: DiscoveryOptions = {}) {
    this.#pluginsDir = options.pluginsDir ?? DEFAULT_PLUGINS_DIR
    this.#workersDir = options.workersDir ?? DEFAULT_WORKERS_DIR
    this.#routesDir = options.routesDir ?? DEFAULT_ROUTES_DIR
  }

  async scan(): Promise<DiscoveryResult> {
    const [plugins, workers, routes] = await Promise.all([
      this.#scanDir(this.#pluginsDir),
      this.#scanDir(this.#workersDir),
      this.#scanDir(this.#routesDir),
    ])
    return { plugins, workers, routes }
  }

  async #scanDir(dir: string): Promise<string[]> {
    try {
      const entries: string[] = []
      const scanDir = new Bun.Glob("*.{ts,js}")
      for await (const match of scanDir.scan({ cwd: dir, onlyFiles: true })) {
        entries.push(`${dir}/${match}`)
      }
      return entries
    } catch {
      return []
    }
  }
}
