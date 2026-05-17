# @bunova/ws

Bunova plugin — WebSocket connection monitoring & observability.

## Install

```bash
bun add @bunova/ws
```

## Usage

```ts
import { runtime } from "bunova"
import { wsPlugin } from "@bunova/ws"

const ws = wsPlugin({ label: "chat-ws", interval: 5000 })
runtime.use(ws)

runtime.on("ready", () => {
  Bun.serve({
    port: 3000,
    fetch(req, server) { server.upgrade(req) },
    websocket: {
      open: () => ws.trackOpen(),
      message: () => ws.trackMessage(),
      close: () => ws.trackClose(),
      drain: () => {},
    },
  })
})

runtime.bus.subscribe("chat-ws:metrics", (m) => {
  console.log(`WS: ${m.connections} connections, ${m.messages} msg/s`)
})
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `{label}:metrics` | `{ connections, messages, errors }` | Periodic metrics snapshot |
