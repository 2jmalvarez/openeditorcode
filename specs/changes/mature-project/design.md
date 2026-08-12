# Design

## Context

The active editor text is projected into the active file tab. Tabs already retain working and saved content, but global dirty checks currently inspect only the active projection. Filesystem confinement is lexical and therefore does not cover links or reparse points. Keyboard routing handles several global commands before non-confirmation overlays.

## Decisions

- File tabs remain the durable in-memory source of truth; the active editor is synchronized before global document operations.
- Quit and update offer save-all or discard-all behavior for dirty tabs. A failed save cancels the pending action.
- Closing one tab continues to reason only about that tab.
- Deletion acts on the path captured by the confirmation. Dirty affected tabs block deletion; clean affected tabs close after successful deletion.
- Existing path components are resolved with `realpath`; the nearest existing ancestor is used when creating a new path. A physical path outside the physical root is rejected.
- Temporary files are same-directory, random, and created exclusively.
- Any open overlay is routed before global shortcuts. Confirmation overlays consume all keyboard events.
- Renamed Git entries retain both current and previous paths.
- Refactoring follows behavior fixes and is limited to dependencies already crossing capability boundaries.

## Alternatives Considered

- Prompt once per dirty tab: rejected because it creates an error-prone modal sequence during quit and update.
- Allow deletion while keeping dirty orphan buffers: rejected because the later save behavior becomes ambiguous and can recreate deleted trees.
- Permit internal symlinks that resolve inside the root: supported by physical path validation; only escapes are rejected.
- Replace the complete workbench architecture: rejected in favor of incremental changes.

## Risks

- Windows rename and junction semantics differ from POSIX behavior.
- TUI test input does not preserve every modifier, so pure state and filesystem tests are preferred where necessary.
- Recursive Git watching can remain expensive for very large projects and should be optimized separately if profiling demonstrates a need.

## Validation Plan

- Run typecheck and tests after each behavioral phase.
- Run a build after application changes.
- Add regression tests for dirty inactive tabs, link escapes, confirmed deletion paths, overlay isolation, Git rename diffs, and stale async results.
- Run package and release preflight checks before final completion.
