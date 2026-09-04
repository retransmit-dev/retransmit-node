# retransmit-node

Node.js SDK for the Retransmit messaging API, published to npm as `retransmit.dev`.
Hand-written, zero runtime dependencies, one file per channel in `src/`.

## Keep it in sync with the API

The API server lives in the main monorepo: https://github.com/retransmit-dev/retransmit
(`apps/api`, OpenAPI document in `apps/web/src/lib/openapi.ts`). This SDK is not generated
from it. Any API change that a client can observe must be mirrored here:

- new or changed endpoint, request field, response field
- new status value or error code
- new channel

Update `src/types.ts` and the channel file, document it in `README.md`, then bump `version`
in `package.json` (semver: additive = minor, breaking = major).

## Tests

Tests live in `tests/`, one file per source module, and are type-checked along with `src`.
`pnpm test` runs vitest against a stubbed `fetch`. No network, no API key, no messages sent.
End-to-end coverage against the live API lives in the dashboard app, not here.

Each channel test declares a `Record<keyof Send…Options, string>` map of option name to
wire field. Adding a field to an options interface without adding it to that map fails
`pnpm check-types`, and satisfying the compiler without updating the payload builder fails
the test. This is deliberate: the payload builders are hand-written, so an unmapped field
otherwise compiles cleanly and silently drops the caller's data at runtime.

## Release

Pushing to `main` runs `.github/workflows/release.yml`. It type-checks, tests, builds, compares
`package.json` version with the npm registry, and publishes only when they differ.
Auth is npm Trusted Publishing (OIDC), no token secret. A push without a version bump is a no-op.
