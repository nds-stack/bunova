# Changelog

## [0.2.0-beta.0] — 2026-05-18

### Changed
- Dependencies: `@nds-stack/bun-logger` → `0.1.0-beta.0`, `@nds-stack/bun-env` → `0.1.0-beta.0`
- Version bumped from alpha to beta — all dependencies now published to npm as beta

### Fixed
- **message-stream.ts**: Separated `#append()` from `#flush()` — `push()` no longer consumes buffer before `readMessageFrom()` can read
- **queue plugin**: `processJob()` moved inside `queuePlugin()` closure — `ReferenceError: save is not defined` fixed
- **AbortController**: Dead `signal` event listener removed from `#readLoop()` in message-stream
- **Reader leak**: Added `reader.cancel()` + `reader.releaseLock()` on timeout in `readMessageFrom()`
- **Worker orchestration**: `#readFrom(reader)` — no longer silent-return on path traversal in channel names
- **Timer leaks**: All `setTimeout`/`setInterval` in `FileWatcher`, `ReloadEngine`, `TelemetryEngine` now use `.unref()`
- **`#tryExtract` recursion**: Guarded to prevent infinite recursion
- **Module-level race**: `Tracer`, `ScopedBus`, `MessageBus` — class instance instead of module-level shared state
- **`proc.kill()`**: `proc.killed` guard + `catch {}` to prevent unhandled rejection
- **Bootstrap**: `bootstrap()` catches all rejections to prevent uncaught promise

## [0.2.0-alpha.1] — 2026-05-17

### Fixed
- **sqlite plugin**: `db.metrics()` → `db.metrics` (metrics is a getter, not a function)

### Changed
- `@nds-stack/bunql` dependency updated from `^0.1.0-alpha.7` to `^0.1.0` in sqlite & queue plugins
- `.gitignore` / `.npmignore` now use glob pattern `*.md` with `!README.md` / `!CHANGELOG.md`

## [0.2.0-alpha.0] — 2026-05-17

### Added
- **Route-level worker isolation** — `runtime.serve()` wraps Bun.serve with RouteProxy
- `RouteRegistry` — auto-discover, spawn, and manage route workers from `src/routes/*.ts`
- `RouteProxy` — URL pattern matching + proxy to route workers via HTTP
- `runtime.serve({ port, fetch })` — drops-in replacement for `Bun.serve()` with route routing
- **@bunova/sqlite plugin** — SQLite monitoring wrapper for `@nds-stack/bunql` (in `plugins/sqlite/`)
- **@bunova/redis plugin** — Redis lifecycle & metrics template (in `plugins/redis/`)
- **@bunova/ws plugin** — WebSocket connection monitoring (in `plugins/ws/`)
- **@bunova/tracing plugin** — Distributed tracing span export (in `plugins/tracing/`)
- **@bunova/auth plugin** — Auth lifecycle hooks with JWT verification (in `plugins/auth/`)
- **@bunova/queue plugin** — Background job orchestration with retry (in `plugins/queue/`)
- `runtime.onMemoryLeak()` now accepts `{ threshold, interval }` options
- **Namespaced events** — `runtime.events.worker/plugin/route/telemetry.on()` via `ScopedBus`
- **MessageStream IPC** — Length-prefixed binary framing for plugin/route worker communication
- **RuntimeKernel** — `RuntimeCore` + manager classes for observability, orchestration, routing, reload
- **Lifecycle.crash()** — crash transition + event emission built into Lifecycle

### Changed
- `ReloadEngine` now supports `onReload()` callbacks for actual reload logic
- Worker healthcheck fires immediately on start (not just on interval)
- **`runtime.boot()` is now `async`** — This is a **breaking change** if you called `boot()` without `await`. Update: `await runtime.boot()` or `runtime.boot().then(() => {...})`. Reason: discovery and watcher init now use `await` internally.
- **Event loop lag**: sync `performance.now()` → async `setTimeout(0)` + cached value
- **MessageBus**: `catch {}` → `catch (err) { onError?.(channel, err) }`
- **Auth plugin**: timing-safe comparison + base64url support
- **Queue plugin**: dynamic import + proper processJob with completion/retry
- **Worker restart**: exponential backoff 1s→2s→4s→...→30s
- **PluginContext.logger**: `LoggerStats` → `PluginLogger { info, warn, error }`
- **Uninstall context**: stub → stored install context reused
- **Port lookup in RouteProxy**: linear scan → `Map<string, number>`
- **Exit delay**: `setTimeout(exit, 0)` → `setTimeout(exit, 100)` for async cleanup
- **Scope discipline**: documented non-goals, removed Distributed Runtime from roadmap
- **Benchmark metodologi**: realistic single-op cold boot (was inflated loop-based)

### Fixed
- package.json version bumped to 0.2.0-alpha.0 (was 0.1.0)
- Runtime version string now matches package.json
- RULES.md folder structure updated to include src/routes/
- Type casts `any` → proper types (`Exclude<Bun.Subprocess["stdin"], number>`)
- Double history push in TelemetryEngine snapshot
- `require()` → dynamic `import()` in queue plugin

### Tests
- Added bootstrap.ts tests (2 tests)
- Added worker edge case tests — maxRestarts, concurrent spawn, clear during spawn (4 tests)
- Added RouteRegistry tests (7 tests)
- Added RouteProxy tests (4 tests)
- Added PluginIsolator IPC tests (6 tests)
- Added ReloadEngine + FileWatcher tests (10 tests)
- Added ScopedBus tests (5 tests)
- Total: 108 tests across 15 files (+ plugin tests in test-plugins/)
