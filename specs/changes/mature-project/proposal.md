# Mature Project Reliability

## Why

OEC has a clear architecture and useful automated tests, but several edge cases can lose inactive document changes, operate on mutable destructive selections, escape lexical path checks through filesystem links, or produce inconsistent keyboard and Git behavior. The delivery pipeline also validates compilation without fully validating packaged executables and version consistency.

## What Changes

- Track unsaved state per file tab and protect every dirty tab during quit and update flows.
- Confine file access physically to the project root and make temporary saves unique and exclusive.
- Reconcile open tabs with confirmed file and directory deletion.
- Give overlays deterministic priority over global shortcuts.
- Support added, deleted, and renamed Git diffs using real repository tests.
- Prevent stale asynchronous operations and search indexes from changing current state.
- Reduce selected cross-capability type dependencies after behavior is stable.
- Extend CI and release preflight checks to packaged artifacts and version consistency.

## Impact

- Affected capabilities: documents, filesystem, explorer, dialogs, keyboard routing, search, Git, updates, build, and CI.
- Existing saved files remain compatible; no persisted data migration is required.
- Some destructive actions become intentionally stricter when dirty tabs are affected.
- Symlinks or junctions escaping the project root are rejected.
