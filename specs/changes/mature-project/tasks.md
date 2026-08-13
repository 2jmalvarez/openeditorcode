# Tasks

## Phase 0: Specification

Goal: Record the maturity initiative as traceable requirements and decisions.
Testable end: The repository contains project context, proposal, design, requirements, and phased tasks.
Validation: Review Markdown structure and alignment with `AGENTS.md`.
Status: completed

- [x] Create project context
- [x] Record proposal and impact
- [x] Record design decisions and alternatives
- [x] Define normative requirements and scenarios
- [x] Define phased implementation checkpoints

Checkpoint: completed. The maturity roadmap is stored under `specs/changes/mature-project/`.

## Phase 1: Document Integrity

Goal: Protect dirty state for every editable tab.
Testable end: Inactive dirty tabs remain marked and block unsafe quit/update actions.
Validation: `bun run typecheck`, `bun run test`, `bun run build`.
Status: completed

- [x] Add per-tab dirty queries and save-all behavior
- [x] Update quit and update confirmation flows
- [x] Display inactive dirty tab indicators
- [x] Add regression tests
- [x] Record checkpoint

Checkpoint: completed. Dirty state is tracked and displayed per tab; quit and update save or discard all pending file tabs. Typecheck, tests, and build passed.

## Phase 2: Filesystem Boundary

Goal: Keep access physically inside the root and strengthen safe saves.
Testable end: Link escapes and temporary-file collisions are rejected or avoided.
Validation: `bun run typecheck`, `bun run test`, `bun run build`.
Status: completed

- [x] Add physical path validation
- [x] Make temporary saves unique and exclusive
- [x] Enforce write size and encoding expectations
- [x] Add filesystem boundary tests
- [x] Record checkpoint

Checkpoint: completed. Physical roots, links, UTF-8, byte limits, exclusive random temporaries, and safe link deletion are covered by filesystem tests.

## Phase 3: Stable Deletion

Goal: Delete the confirmed entry without losing open buffers.
Testable end: Selection changes cannot alter the target and dirty affected tabs block deletion.
Validation: `bun run typecheck`, `bun run test`, `bun run build`.
Status: completed

- [x] Delete by captured path
- [x] Reconcile affected clean tabs
- [x] Block dirty affected tabs
- [x] Add regression tests
- [x] Record checkpoint

Checkpoint: completed. Deletion uses the captured path, blocks affected dirty tabs, closes affected clean tabs, and has pure path-policy regression coverage. Direct Delete-key TUI automation remains unsupported by the test renderer.

## Phase 4: Overlay Keyboard Routing

Goal: Give overlays deterministic priority.
Testable end: Global shortcuts cannot execute behind an open overlay.
Validation: `bun run typecheck`, `bun run test`, `bun run build`.
Status: completed

- [x] Reorder keyboard routing
- [x] Capture creation directory when opening the dialog
- [x] Restrict editor commands to valid focus contexts
- [x] Remove dead interaction types and props
- [x] Add keyboard matrix regressions
- [x] Record checkpoint

Checkpoint: completed. Modal overlays route before global commands, confirmations consume all keys, creation uses a captured directory, and palette isolation has TUI regression coverage.

## Phase 5: Git Diff Reliability

Goal: Support every declared Git file state.
Testable end: Temporary real repositories produce correct added, deleted, and renamed diffs.
Validation: `bun run typecheck`, `bun run test`, `bun run build`.
Status: completed

- [x] Retain previous rename paths
- [x] Correct added and renamed previous content
- [x] Move pure diff alignment out of TSX
- [x] Add real repository tests
- [x] Record checkpoint

Checkpoint: completed. Added, deleted, and renamed diffs are validated against temporary Git repositories, and diff alignment is UI-independent.

## Phase 6: Async and Search Consistency

Goal: Prevent stale operations and expose bounded results.
Testable end: Failed or stale opens do not move the wrong editor and truncated indexes are visible.
Validation: `bun run typecheck`, `bun run test`, `bun run build`.
Status: completed

- [x] Return explicit open-file outcomes
- [x] Protect concurrent file opens
- [x] Unify explorer refresh invalidation
- [x] Expose index truncation
- [x] Add dedicated concurrent-open and bounded-index regressions
- [x] Record checkpoint

Checkpoint: completed. Open generations prevent stale activation and stale failures, failed search results do not move the previous editor, refresh uses one invalidating path, and bounded indexes report partial results. Dedicated regressions use injected reads and a configurable production limit seam.

## Phase 7: Architecture Cleanup

Goal: Reduce concrete cross-capability dependencies without changing behavior.
Testable end: Shared contracts have capability-appropriate owners and keyboard props are grouped or reduced.
Validation: `bun run typecheck`, `bun run test`, `bun run build`.
Status: completed

- [x] Move command types out of presentation components
- [x] Decouple search indexing from explorer presentation state
- [x] Reduce dead and oversized contracts
- [x] Record checkpoint

Checkpoint: completed. Commands have a dialog-owned type, search has an infrastructure index model, dead interaction variants and props were removed, and no broad workbench rewrite was introduced.

## Phase 8: CI and Release Maturity

Goal: Validate package and executable artifacts before release.
Testable end: CI checks package contents, versions, and executable startup.
Validation: local scripts plus workflow review.
Status: completed

- [x] Add version consistency preflight
- [x] Add package checks to CI
- [x] Add executable structural and real TUI smoke checks by platform
- [x] Pin unstable development type dependencies
- [x] Record checkpoint

Checkpoint: completed. CI validates versions, packages, binary format, size, Linux executable permission, per-file coverage thresholds, and a real TUI startup through its first rendered frame. Launcher tests cover exit code 42, update retry, and relaunch.

## Final Check

- [x] Confirm implemented normative requirements
- [x] Verify specs, tasks, code, and tests are aligned
- [x] Verify no new `any` or type suppressions
- [x] Run final typecheck, tests, build, and available package checks
- [x] Document residual risks and manual tests in phase checkpoints

Final checkpoint: completed for version 0.2.7. Typecheck, 51 tests with 80.15% line and 77.98% function coverage, Windows build, release preflight for `v0.2.7`, structural smoke, real TUI smoke, root and Windows package dry runs, and `git diff --check` passed. Cross-platform package aggregation remains delegated to the Windows/Linux CI matrix.

## Phase 9: Git Change Summary and Welcome Navigation

Goal: Make changed-file scope and primary panel navigation immediately visible.
Testable end: The Git panel shows `CAMBIOS N`, stable file numbers, and colored `+/-` statistics; the welcome screen prominently shows the three panel shortcuts.
Validation: `bun run typecheck`, `bun run test:coverage`, `bun run build`, `bun run smoke:tui`.
Status: completed

- [x] Read tracked numstat data in one Git command per refresh
- [x] Count readable untracked files and handle unknown/binary statistics
- [x] Render total, stable numbering, green additions, and red deletions
- [x] Recalculate statistics through watcher and F5 refresh paths
- [x] Add primary welcome-screen panel navigation
- [x] Collapse narrow welcome areas to vertical OEC
- [x] Update README and version to 0.2.8
- [x] Complete final validation checkpoint

Checkpoint: completed for version 0.2.8. Typecheck, 60 tests with 81.95% line and 79.40% function coverage, Windows build, release preflight for `v0.2.8`, structural smoke, real TUI smoke, and `git diff --check` passed. Renderer tests verify the visible Git total/number/statistics, the primary welcome navigation block, and vertical OEC in narrow central areas.
