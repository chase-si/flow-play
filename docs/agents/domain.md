# Domain Docs

This repository uses a single-context domain documentation layout.

## Layout

- Root `CONTEXT.md` is the canonical project context document when present.
- Root `docs/adr/` is the canonical architectural decision record directory when present.

## Consumer Rules

- Read `CONTEXT.md` before making broad architectural changes once it exists.
- Read relevant ADRs under `docs/adr/` before changing decisions they cover.
- If context or ADR files do not exist yet, rely on current issue and conversation context, then create or update domain docs when the task explicitly calls for it.
