import type { Plugin } from "bunova"

export interface QueueOptions {
  label?: string
  db?: {
    query: (sql: string, params?: unknown[]) => unknown[]
    run: (sql: string, params?: unknown[]) => { changes: number }
  }
  pollInterval?: number
  maxRetries?: number
}

export interface Job {
  id: string
  type: string
  payload: unknown
  status: "pending" | "running" | "done" | "failed"
  retries: number
  maxRetries: number
  createdAt: string
  error?: string
}

type JobHandler = (job: Job) => Promise<void>

export function queuePlugin(options: QueueOptions = {}): Plugin {
  const label = options.label ?? "queue"
  const maxRetries = options.maxRetries ?? 3
  const pollInterval = options.pollInterval ?? 1000
  let timer: Timer | null = null
  let jobHandler: JobHandler | null = null

  async function initDb() {
    if (options.db) return options.db

    try {
      const { BunQL } = await import("@nds-stack/bunql") as { BunQL: new (path: string) => { query: Function; run: Function } }
      const db = new BunQL(`:memory:`)
      db.run("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, type TEXT, payload TEXT, status TEXT, retries INT, max_retries INT, created_at TEXT, error TEXT)")
      return db as { query: Function; run: Function }
    } catch {
      return null
    }
  }

  const storePromise = initDb()
  const memJobs = new Map<string, Job>()

  async function save(job: Job) {
    const store = await storePromise
    if (store) {
      store.run(
        "INSERT OR REPLACE INTO jobs VALUES (?,?,?,?,?,?,?,?)",
        [job.id, job.type, JSON.stringify(job.payload), job.status, job.retries, job.maxRetries, job.createdAt, job.error ?? null]
      )
    } else {
      memJobs.set(job.id, job)
    }
  }

  async function loadPending(): Promise<Job[]> {
    const store = await storePromise
    if (store) {
      const rows = store.query(
        "SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC"
      ) as Array<Record<string, unknown>>
      return rows.map(r => ({
        id: r.id as string,
        type: r.type as string,
        payload: JSON.parse(r.payload as string),
        status: r.status as Job["status"],
        retries: r.retries as number,
        maxRetries: r.maxRetries as number,
        createdAt: r.created_at as string,
        error: r.error as string | undefined,
      }))
    }
    return Array.from(memJobs.values()).filter(j => j.status === "pending")
  }

  async function loadAll(): Promise<Job[]> {
    const store = await storePromise
    if (store) {
      const rows = store.query("SELECT * FROM jobs ORDER BY created_at ASC") as Array<Record<string, unknown>>
      return rows.map(r => ({
        id: r.id as string,
        type: r.type as string,
        payload: JSON.parse(r.payload as string),
        status: r.status as Job["status"],
        retries: r.retries as number,
        maxRetries: r.maxRetries as number,
        createdAt: r.created_at as string,
        error: r.error as string | undefined,
      }))
    }
    return Array.from(memJobs.values())
  }

  async function processJob(job: Job, handler: JobHandler, ctx: { broadcast: Function }) {
    job.status = "running"
    await save(job)
    ctx.broadcast(`${job.type}:started`, { id: job.id })

    try {
      await handler(job)
      job.status = "done"
      await save(job)
      ctx.broadcast(`${job.type}:done`, { id: job.id })
    } catch (err) {
      job.retries++
      const errMsg = err instanceof Error ? err.message : String(err)

      if (job.retries <= job.maxRetries) {
        job.status = "pending"
        job.error = errMsg
        await save(job)
        ctx.broadcast(`${job.type}:retry`, { id: job.id, retries: job.retries, error: errMsg })
      } else {
        job.status = "failed"
        job.error = errMsg
        await save(job)
        ctx.broadcast(`${job.type}:failed`, { id: job.id, error: errMsg })
      }
    }
  }

  return {
    name: label,
    version: "0.1.1",
    install(ctx) {
      ctx.on("shutdown", () => {
        if (timer) clearInterval(timer)
      })

      ctx.broadcast(`${label}:ready`, {})

      timer = setInterval(async () => {
        if (!jobHandler) return
        const pending = await loadPending()
        for (const job of pending) {
          await processJob(job, jobHandler, ctx)
        }
      }, pollInterval)

      return {
        enqueue: (type: string, payload: unknown) => {
          const job: Job = {
            id: crypto.randomUUID(),
            type,
            payload,
            status: "pending",
            retries: 0,
            maxRetries,
            createdAt: new Date().toISOString(),
          }
          save(job)
          ctx.broadcast(`${label}:enqueued`, { id: job.id, type })
          return job
        },

        process: async (handler: JobHandler) => {
          jobHandler = handler

          // Process any existing pending jobs
          const pending = await loadPending()
          for (const job of pending) {
            await processJob(job, handler, ctx)
          }
        },

        stats: async () => {
          const all = await loadAll()
          const counts = { pending: 0, running: 0, done: 0, failed: 0 }
          for (const j of all) counts[j.status]++
          return counts
        },
      }
    },
  }
}
