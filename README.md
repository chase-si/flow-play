# Flow Play

Flow Play is organized as a pnpm workspace with one publishable package and one demo app.

## Workspace

- `packages/flow-play`: publishable package that exposes the public Flow Play API.
- `apps/demo`: Vite React demo app that imports the package through the workspace boundary.

## Development

```sh
pnpm install
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The root scripts run across all workspaces so package and app boundaries stay visible.

## Regression Checks

Run the browser journey locally after installing Playwright's Chromium browser once:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Use these commands for a CI-equivalent local gate:

```sh
pnpm lint
pnpm test
pnpm --filter flow-play build
pnpm --filter @flow-play/demo build
pnpm test:e2e
```

GitHub Actions runs the same regression gate on pull requests and pushes to `main`.

## Package Build

`flow-play` publishes two public entrypoints:

- `flow-play`: the headless playback API from `packages/flow-play/src/index.ts`.
- `flow-play/react-flow`: React Flow integration helpers from `packages/flow-play/src/react-flow.ts`.

Run `pnpm package:check` before publishing package changes. It builds both entrypoints
with tsup as ESM and CommonJS output, then emits TypeScript declarations into
`packages/flow-play/dist`. React, React DOM, and `@xyflow/react` are peer dependencies
and are explicitly externalized from the bundle.

## Manual Release

Releases use Changesets and remain manual. Maintainers should:

1. Run `pnpm changeset` while developing a change that should be released.
2. Run `pnpm version` to apply pending version and changelog updates.
3. Run `pnpm release` to rebuild the package and publish the prepared version.

The repository does not configure automated npm publishing credentials.
