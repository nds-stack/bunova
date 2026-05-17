# @bunova/auth

Bunova plugin — auth lifecycle hooks & JWT verification.

## Install

```bash
bun add @bunova/auth
```

## Usage

```ts
import { runtime } from "bunova"
import { authPlugin } from "@bunova/auth"

const auth = authPlugin({
  secret: process.env.JWT_SECRET,
})

runtime.use(auth)

runtime.on("ready", async () => {
  const result = await auth.verify("eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.signature")
  if (result?.valid) {
    console.log("User:", result.user)
  }
})
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `{label}:ready` | `{}` | Auth plugin initialized |
