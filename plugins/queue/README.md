# @bunova/queue

Bunova plugin — background job orchestration with retry & scheduling.

## Install

```bash
bun add @bunova/queue
```

Optionally with SQLite persistence:

```bash
bun add @bunova/queue @nds-stack/bunql
```

## Usage

```ts
import { runtime } from "bunova"
import { queuePlugin } from "@bunova/queue"

const queue = queuePlugin({
  pollInterval: 1000,
  maxRetries: 3,
})

runtime.use(queue)

// Enqueue a job
queue.enqueue("email:send", { to: "user@example.com", template: "welcome" })

// Process jobs
queue.process(async (job) => {
  if (job.type === "email:send") {
    console.log(`Sending email to ${job.payload.to}`)
  }
})

// Listen for events
runtime.bus.subscribe("email:send:started", (event) => {
  console.log(`Job started: ${event.id}`)
})
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `{label}:ready` | `{}` | Queue plugin initialized |
| `{label}:enqueued` | `{ id, type }` | New job added to queue |
| `{type}:started` | `{ id }` | Job processing started |
