# @bunova/redis

Bunova plugin — Redis connection monitoring & lifecycle management.

Requires a Redis client (e.g., `ioredis`).

## Install

```bash
bun add @bunova/redis ioredis
```

## Usage

```ts
import { runtime } from "bunova"
import { redisPlugin } from "@bunova/redis"

runtime.boot()

runtime.use(redisPlugin({
  url: "redis://localhost:6379",
  label: "cache",
  interval: 5000,
}))

// Listen for metrics
runtime.bus.subscribe("cache:metrics", (payload) => {
  console.log("Redis status:", payload.status)
})
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `{label}:ready` | `{ url }` | Redis connected and ready |
| `{label}:metrics` | `{ status }` | Periodic metrics snapshot |
| `{label}:error` | `{ message }` | Connection or runtime error |
