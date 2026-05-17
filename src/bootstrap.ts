import type { BootstrapOptions } from "./types.ts"

export function bootstrap(entryPoint: string, options: BootstrapOptions = {}): void {
  const {
    restart = true,
    restartDelay = 1000,
    maxRestarts = 10,
    env = {},
  } = options

  async function run(): Promise<void> {
    let restarts = 0

    while (true) {
      const proc = Bun.spawn(["bun", "run", entryPoint], {
        env: { ...process.env, ...env, BUNOVA_BOOTSTRAP: "true" },
        stdio: ["inherit", "inherit", "inherit"],
      })

      const exitCode = await proc.exited

      if (!restart) {
        process.exit(exitCode ?? 0)
        return
      }

      if (exitCode === 0) {
        process.exit(0)
        return
      }

      restarts++
      if (restarts > maxRestarts) {
        console.error(`[Bunova Bootstrap] Max restarts (${maxRestarts}) reached. Exiting.`)
        process.exit(1)
        return
      }

      await Bun.sleep(restartDelay)
    }
  }

  run().catch(err => { console.error(err); process.exit(1) })
}
