# Spec

## ADDED Requirements

### Requirement: Global Dirty Document Protection

The system MUST track modified state independently for every editable tab and MUST NOT quit or update while any dirty tab is ignored.

#### Scenario: Inactive tab is dirty

- WHEN a user modifies tab A and activates clean tab B
- THEN tab A remains visibly dirty
- AND quit or update requests require an explicit save-all or discard-all decision

#### Scenario: Save all fails

- WHEN saving any dirty tab fails during quit or update
- THEN the application remains open
- AND the failed tab remains dirty

### Requirement: Physical Project Confinement

The system MUST reject read, create, save, and traversal operations whose physical filesystem location escapes the selected root.

#### Scenario: Link escapes root

- WHEN an internal symlink or junction resolves outside the selected root
- THEN file access through that link is rejected

### Requirement: Stable Destructive Confirmation

The system MUST apply a confirmed deletion to the exact captured path, independent of later selection changes.

#### Scenario: Dirty affected tab

- WHEN deletion affects an open dirty file tab
- THEN deletion is rejected without discarding or orphaning the tab

#### Scenario: Clean affected tab

- WHEN deletion affects an open clean file tab
- THEN deletion succeeds and the affected tab closes

### Requirement: Overlay Keyboard Isolation

The system MUST route an open overlay before global and panel shortcuts.

#### Scenario: Global shortcut during overlay

- WHEN a command palette, project search, new-file dialog, or confirmation is open
- AND the user presses a global shortcut not owned by that overlay
- THEN the underlying command does not execute

### Requirement: Complete Git File Diffs

The system MUST produce coherent previous and current content for modified, added, untracked, deleted, and renamed files.

#### Scenario: Renamed file

- WHEN Git reports a renamed path
- THEN the previous content is read from the original path
- AND the current content is read from the new path

### Requirement: Observable Partial Search

The system MUST identify search and line-count results as partial when the project index limit is reached.

### Requirement: Release Preflight

The release workflow MUST validate package versions, package contents, and platform executable startup before publishing.

## MODIFIED Requirements

### Requirement: Safe Save

Document saves MUST use a unique exclusive temporary file in the destination directory, MUST clean it after failures, and MUST reject content above the supported size limit.

### Requirement: Search Cache Invalidation

Explorer refresh, create, delete, and relevant document operations MUST invalidate stale project indexes consistently.
