# @bunova/sqlite

Bunova plugin — SQLite monitoring & lifecycle management via `@nds-stack/bunql`.

## Install

```bash
bun add @bunova/sqlite
```

## Usage

```ts
import { runtime } from "bunova"
import { sqlitePlugin } from "@bunova/sqlite"

runtime.boot()

runtime.use(sqlitePlugin({
  path: "./data/app.db",
  label: "app-db",
  interval: 5000,  // metrics every 5s
}))

// Listen for metrics
runtime.bus.subscribe("app-db:metrics", (payload) => {
  console.log("SQLite writes:", payload.writes.total)
})
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `{label}:ready` | `{ path }` | Database connected and ready |
| `{label}:metrics` | `{ writes, reads, queue }` | Periodic metrics snapshot |
| `{label}:error` | `{ message }` | Error during metric collection |
