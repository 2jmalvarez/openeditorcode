# Project

## Purpose

OpenEditorCode (OEC) is a standalone project editor for Windows Terminal and Linux terminals. It combines a project explorer, text editing, tabs, search, Git changes, clipboard access, and project metrics without requiring a server.

## Tech Stack

- Runtime: Bun 1.3 or newer
- Language: strict TypeScript
- UI: OpenTUI Solid and SolidJS
- Testing: Bun test with the OpenTUI preload
- Build: Bun compiled executables for Windows x64 and Linux x64
- Distribution: npm launcher plus platform-specific optional packages

## Conventions

- Organize code by product capability: documents, explorer, editor, search, dialogs, Git, and updates.
- Keep OpenTUI dependencies in TSX presentation modules whenever possible.
- Keep keyboard routing centralized in `useKeyboardShortcuts.ts`.
- Route document filesystem access through `documents/files.ts`.
- Preserve strict typing and do not introduce `any` or type suppressions.
- Keep changes small, testable, and compatible with keyboard-only operation.

## Commands

- Install: `bun install`
- Develop: `bun run dev`
- Typecheck: `bun run typecheck`
- Test: `bun run test`
- Build: `bun run build`
- Package check: `bun run pack:check`

## Domain Notes

- A file tab owns its working content and last saved content.
- Diff tabs are read-only.
- An editor without a file path is never dirty.
- All filesystem operations must remain physically inside the selected project root.
- Overlays take priority over global shortcuts.
- Search excludes `.git`, respects the supported `.gitignore` rules, and limits file processing to 2 MB.
