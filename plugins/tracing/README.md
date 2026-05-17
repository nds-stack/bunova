# @bunova/tracing

Bunova plugin — distributed tracing via span export. Collects spans from `runtime.tracer` and exports them via HTTP or broadcast.

## Install

```bash
bun add @bunova/tracing
```

## Usage

```ts
import { runtime } from "bunova"
import { tracingPlugin } from "@bunova/tracing"

const tracing = tracingPlugin({
  serviceName: "api-gateway",
  endpoint: "http://jaeger:4318/v1/traces", // optional HTTP export
})

runtime.use(tracing)

// Record spans manually
tracing.record("db.query", 12.3, { table: "users" })
tracing.record("http.external", 45.1, { url: "https://api.example.com" })

// Or listen for spans via bus
runtime.bus.subscribe("tracing:spans", (payload) => {
  console.log(`Exported ${payload.spans.length} spans from ${payload.service}`)
})
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `{label}:spans` | `{ service, spans }` | Batched span export (every 5s) |
