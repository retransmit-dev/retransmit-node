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

## Release

Pushing to `main` runs `.github/workflows/release.yml`. It type-checks, builds, compares
`package.json` version with the npm registry, and publishes only when they differ.
Auth is npm Trusted Publishing (OIDC), no token secret. A push without a version bump is a no-op.
