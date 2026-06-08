# PRD: Initialize Flow Play Framework

## Problem Statement

The user wants to create a React Flow-based toolkit that can automatically play through a sequence of flow steps. The project should start with a framework that is credible for library development: publishable to npm, testable at multiple levels, and supported by a demo page that enables manual review of the playback experience.

The repository is currently empty except for Git metadata, so the immediate problem is not implementing every feature. The immediate problem is establishing the correct project shape, module boundaries, testing strategy, build pipeline, and minimum vertical slice so future implementation can proceed without reworking the foundation.

## Solution

Initialize a pnpm workspace with one publishable npm package and one demo app. The package exposes a headless playback engine through the main entrypoint and a React Flow adapter through a `react-flow` sub-entrypoint. The headless layer owns playback state and timing without depending on React, DOM, or React Flow. The React Flow adapter maps playback state onto React Flow nodes, edges, controls, and optional viewport behavior.

The first implementation slice should prove the full framework works end to end: a minimal headless playback API, a `useFlowPlayback` adapter skeleton, an interactive Vite demo, unit/component tests with Vitest, a Playwright journey against the demo, a library build with tsup, strict TypeScript, linting, formatting, and manual Changesets-based release scripts.

## User Stories

1. As a library author, I want the project to use pnpm workspaces, so that the npm package and demo app have clear boundaries.
2. As a library author, I want a single publishable npm package, so that first-version publishing stays simple.
3. As a library user, I want a main package entrypoint for playback logic, so that I can use the playback engine without React Flow.
4. As a library user, I want a React Flow sub-entrypoint, so that React Flow-specific code is isolated from the headless core.
5. As a library user, I want the playback engine to be headless, so that playback behavior can be tested and reasoned about without browser rendering.
6. As a library user, I want steps to be serializable intent data, so that playback sequences can be stored, inspected, tested, and reused.
7. As a library user, I want linear step playback in the first version, so that the initial API remains understandable and stable.
8. As a library user, I want global default step duration with per-step overrides, so that common timing is simple and exceptions remain possible.
9. As a library user, I want playback to stop on the final step and enter a completed state, so that completion has clear semantics.
10. As a library user, I want non-controlled playback state with callbacks, so that I can get useful behavior without wiring external state.
11. As a library user, I want each step to support typed metadata, so that my application can attach business-specific information without conflicting with official fields.
12. As a library user, I want validation errors for invalid core playback configuration, so that mistakes are caught early.
13. As a React Flow user, I want the adapter to return enhanced nodes and edges, so that I can pass them directly to React Flow.
14. As a React Flow user, I want active node and edge IDs exposed separately, so that I can implement custom rendering if needed.
15. As a React Flow user, I want viewport movement to be optional and disabled by default, so that the toolkit does not take over my canvas unexpectedly.
16. As a React Flow user, I want optional viewport behavior in the demo, so that I can review the narrative playback experience.
17. As a React developer, I want a `useFlowPlayback` hook, so that I can compose playback behavior into my own UI.
18. As a React developer, I want a small set of unstyled controls, so that I can get accessible defaults without accepting a visual design system.
19. As a React developer, I want controls to provide default English labels and aria labels, so that the default UI is testable and accessible.
20. As a React developer, I want labels to be overridable, so that applications can localize or customize control text.
21. As a demo reviewer, I want a runnable demo page, so that I can manually inspect playback behavior before relying on the package.
22. As a demo reviewer, I want play, pause, previous, next, and reset controls, so that I can exercise the core playback workflow.
23. As a demo reviewer, I want a visible current step title and description, so that I can understand what the playback is presenting.
24. As a demo reviewer, I want a clickable step list, so that I can jump to a specific step and review non-linear user navigation even though playback itself is linear.
25. As a demo reviewer, I want visible node and edge highlighting, so that I can confirm the adapter maps step intent correctly.
26. As a demo reviewer, I want an automatic viewport toggle, so that I can compare passive and guided canvas behavior.
27. As a maintainer, I want Vitest unit tests for the headless state machine, so that playback logic regressions are caught quickly.
28. As a maintainer, I want Vitest component tests for React adapter behavior, so that hook and control contracts are covered without a full browser journey.
29. As a maintainer, I want Playwright journey tests against the demo, so that the full user-facing review flow is protected.
30. As a maintainer, I want TypeScript strict mode, so that public APIs remain strongly typed.
31. As a maintainer, I want ESLint and Prettier, so that code quality and formatting are consistent from the beginning.
32. As a maintainer, I want tsup to build the package, so that ESM, CJS, and type output are produced for npm consumers.
33. As a maintainer, I want Vite to run the demo, so that the demo app has a standard fast development server.
34. As a maintainer, I want React, React DOM, and React Flow as peer dependencies, so that consumers do not get duplicate framework instances.
35. As a maintainer, I want Changesets configured for manual publishing, so that npm release flow exists without requiring automated publish credentials yet.
36. As a maintainer, I want GitHub Actions to run lint, tests, build, and e2e, so that the framework does not silently decay.
37. As a future contributor, I want a minimal vertical slice instead of empty directories, so that package entrypoints, demo wiring, and tests are proven together.
38. As a future contributor, I want unsupported advanced features to be out of scope, so that first-version work can focus on a stable core.

## Implementation Decisions

- The repository will use a pnpm workspace.
- The workspace will contain one publishable package and one demo app.
- The publishable package will be a single npm package with multiple entrypoints.
- The main package entrypoint will expose the headless playback engine.
- The React Flow sub-entrypoint will expose React Flow-specific hooks and components.
- The headless playback engine will not depend on React, DOM APIs, or React Flow.
- The first version will support linear playback only.
- Step definitions will be serializable intent data rather than direct React Flow imperative commands.
- Step definitions will support IDs, presentation fields, node and edge references, optional viewport intent, optional duration override, and generic metadata.
- Playback timing will use a global default duration with optional per-step duration overrides.
- Playback will be non-controlled by default and expose event callbacks for status and step changes.
- Playback controls will include play, pause, next, previous, reset, and go-to-step behavior.
- Playback completion will stop on the final step and enter a completed status.
- Core configuration errors will be validated strictly.
- React Flow mapping diagnostics, such as unknown node or edge references, should be diagnostic rather than unnecessarily crashing dynamic flows.
- The React Flow adapter will return enhanced nodes and edges plus active node and edge ID collections.
- The React Flow adapter will support optional viewport behavior that is disabled by default.
- The React Flow controls will be unstyled but semantically accessible.
- The React Flow controls will provide English default labels and allow label overrides.
- The demo will be a complete interaction review page, not a documentation site.
- The package will be built with tsup.
- The demo will be built and served with Vite.
- React, React DOM, and `@xyflow/react` will be peer dependencies of the package.
- TypeScript strict mode, ESLint, Prettier, and Changesets will be configured from the start.
- Changesets will support manual release scripts; automated npm publishing is not part of the initial framework.
- GitHub Actions will run lint, tests, build, and Playwright e2e.

## Testing Decisions

- Tests should verify external behavior and public contracts rather than implementation details.
- Headless playback state transitions should be tested with Vitest unit tests.
- Unit tests should cover play, pause, next, previous, go-to-step, reset, timer-driven advancement, completed state, duration overrides, and validation errors.
- React Flow adapter behavior should be tested with Vitest component tests.
- Component tests should cover enhanced nodes and edges, active ID exposure, callback behavior, and unstyled controls invoking playback actions.
- The demo should be tested with Playwright as a journey-level test.
- Playwright should cover opening the demo, starting playback, pausing playback, stepping forward or backward, resetting, and verifying visible high-level playback state.
- Playwright tests are intended to support human review, not replace focused unit and component tests.
- Because the repository is currently empty, there is no prior in-repo test pattern to preserve.

## Out of Scope

- Full MVP feature completion beyond the minimum vertical slice.
- Branching steps, conditional playback, or decision-tree execution.
- A fully controlled playback API.
- A complete `FlowPlayer` all-in-one component.
- A documentation site.
- Bundled visual styling for library controls.
- Automatic npm publishing with GitHub Actions and npm tokens.
- Multiple npm packages such as separate core and React Flow packages.
- Supporting renderers other than React Flow.
- Supporting package managers other than pnpm.

## Further Notes

The agreed initialization target is a runnable framework with a minimal vertical slice, not an empty scaffold. The goal is to prove the package entrypoints, demo, build, tests, and e2e wiring all work before expanding the toolkit.
