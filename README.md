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
pnpm build
```

The root scripts run across all workspaces so package and app boundaries stay visible.
