# openeditorcode (OEC)

English | [Español](README.es.md)

An open-source project editor for the terminal. It is a standalone TypeScript application built with Bun and OpenTUI; it does not require OpenCode, a server, or an external connection.

The Spanish reference manual is available in [docs/manual.md](docs/manual.md); the npm installation also provides `man oec` on Unix. In OEC, `Ctrl+P` includes **Open OEC settings** and **Open OEC manual**.

## Main view

When launched with no open documents, OEC shows the Explorer and, with at least 144 columns available, the Changes pane as well. `Ctrl+B` and `Ctrl+Alt+B` show or hide each side pane, while `Ctrl+Shift+Left/Right` moves focus between panes. The remaining shortcuts are organized by capability below. If the center area becomes narrower than the Explorer, the help text is hidden and only vertical `OEC` is shown.

![OpenEditorCode main screen](docs/images/welcome-screen.png)

## Features

- Virtualized Explorer with file-type icons, keyboard selection, and vertical scrolling that follows selection in large projects.
- Keyboard-first UI with complementary mouse support in the Explorer, search results, Git changes, and tabs.
- Create files in the selected folder without overwriting existing files.
- Multiple open tabs, circular tab switching, clickable close buttons, and `Delta` Git diff tabs.
- Multi-line editor with line numbers, basic code highlighting, line wrapping, undo/redo, and preserved LF/CRLF line endings.
- Built-in formatting with `Alt+Shift+F`, Prettier for common web formats, optional format on save, and configurable external formatters.
- Read-only Markdown preview by default, with `F4` to switch between preview and editing; the built-in manual is always read-only.
- PNG, JPEG, WebP, and GIF previews using Kitty or Sixel when available, with terminal blocks as a fallback.
- OSC 52 copy and system clipboard paste on Windows, Wayland, and X11.
- Local literal search and project-wide concurrent search backed by a reusable index of up to 50,000 entries.
- Per-file and indexed-project line counts.
- Modal confirmation for unsaved work, deletion, and external file changes detected before saving.
- Virtualized Git Changes pane with staging, commits, pull/push, aligned read-only diffs, intra-line highlighting, and overview markers.
- Session-only error log available through `F12`.
- Protection against paths outside the project root, symlinks/junctions that escape it, invalid UTF-8, binary files, and files over 2 MiB.

## Requirements

- Windows x64 or Linux x64 with glibc (Ubuntu, Debian, Fedora, and derivatives).
- Node.js 18+ and npm to install and launch OEC from npm.
- Bun 1.3+ for development only.
- Git for the Git Changes pane.
- On Linux, `wl-paste` (Wayland), `xclip`, or `xsel` to paste from the system clipboard.

## Installation

Install OEC globally from npm:

```bash
npm install -g openeditorcode
```

Then launch the editor in the current directory or provide a project folder:

```bash
oec
oec /path/to/project
openeditorcode
openeditorcode /path/to/project
```

`oec` and `openeditorcode` are equivalent commands. Use `--` before a project path that starts with a hyphen.

You can also inspect help and version information without starting the interface:

```bash
oec --help
oec -h
oec --version
oec -V
```

OEC checks for updates in the background after startup. If a new version is found, it is displayed alongside the current version. **Update OEC** is available in `Ctrl+P` only when OEC was launched through the npm launcher; it closes the editor, installs the latest package, and reopens the same project.

The npm installation includes only the launcher and the current platform binary; build dependencies are not installed globally.

## Configuration and language

OEC stores configuration outside projects and the npm installation, so it survives updates:

- Windows: `%APPDATA%\openeditorcode\config.json`.
- Linux: `${XDG_CONFIG_HOME:-~/.config}/openeditorcode/config.json`.
- Managed environments or tests: `OEC_CONFIG_DIR` sets the configuration directory.

Open the command palette with `Ctrl+P` and select **Open settings** to change common preferences in the TUI or edit the advanced JSON. Use up/down arrows to select a preference, `Enter` to change it, left/right arrows to switch between the global and project scopes, `E` to edit the JSON for the active scope, and `Esc` to close settings. Saved configuration is validated; see [`docs/oec-config.schema.json`](docs/oec-config.schema.json) for the distributed schema. It includes syntax theme, formatting, keyboard bindings, and a basic Vim profile. A project can override preferences in `.oec/config.json`; those values take priority, but project configuration cannot declare external formatter executables.

Default shortcuts listed below can be overridden through `keyboard.bindings`. `keyboard.profile: "vim"` enables basic Normal, Insert, and Visual modes; it is not a complete Vim emulation. The supported Normal/Visual navigation is `h`, `j`, `k`, `l`, `w`, `b`, `0`, and `$`; Normal mode also supports `i`, `a`, `v`, `u`, `x`, `dd`, and `gg`.

The default language follows the operating system. `appearance.language` accepts `"auto"`, `"es"`, and `"en"`.

Earlier configuration versions are migrated automatically. If JSON is invalid, has incompatible values, or prevents OEC from starting, the problematic version is preserved in `config.bkp.json` and `config.json` is restored with factory settings. The single backup is replaced on each recovery; OEC displays a notice after a restore.

Exclusions added through `Ctrl+E` are intentionally temporary: they are not written to `.gitignore` or `config.json`.

## Run from source

From the `openeditorcode` project folder:

```powershell
bun install
bun run dev
```

To open another project during development:

```powershell
bun run dev -- C:\path\to\project
```

Without an argument, OEC opens the current directory. After a Windows build, the executable is at `packages\oec-win32-x64\bin\oec.exe`:

```powershell
.\packages\oec-win32-x64\bin\oec.exe
```

## Basic use

1. Press `Ctrl+B` to show or hide the Explorer.
2. Use arrow keys to move the selection.
3. Press `Enter` to expand a folder or open a file.
4. Use `Tab` to switch between Explorer, Editor, and Changes.
5. Save with `Ctrl+S`.

When closing a modified tab, the dialog offers **Save**, **Save and close**, and **Close without saving** (the default). Use up/down arrows and confirm with `Enter`. If a file changes outside OEC before saving, choose whether to reload it, overwrite it, or cancel.

`Ctrl+F` is contextual: in Explorer it filters project files by name, and in Editor it searches the open file. `Esc` cancels and clears either search. Project search preserves its query, results, and selection when opening a result, reuses its index for the session, and clears with `Esc` from the modal.

Markdown (`.md`, `.markdown`, `.mdown`, and `.mkd`) opens as rendered preview by default. `F4` switches between editable source and preview while retaining unsaved changes. The manual opened from the palette always remains read-only. PNG, JPEG, WebP, and GIF open as read-only previews; OEC prefers Kitty or Sixel when supported and falls back to terminal blocks.

When an operation fails, OEC keeps the operation, time, and technical details in the session log. The footer displays `F12` while unread errors exist; `F12` or **Open session error log** from the palette opens a read-only central tab that is not persisted after OEC closes.

## Command palette

Press `Ctrl+P` to open the command palette, then type to filter commands, use arrows to select one, and press `Enter` to run it. It provides access to common actions, including opening global or project settings, the built-in manual, the session error log, project line counting, and refreshing Git remote references. When available, it also offers the npm-based OEC update.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+P` | Command palette, shortcuts, and configuration |
| `Ctrl+Shift+Left` | Move focus to the left pane |
| `Ctrl+Shift+Right` | Move focus to the right pane |
| `Ctrl+B` | Show or hide the Explorer |
| `Ctrl+Alt+B` | Show or hide Git Changes |
| `Ctrl+Shift+Enter` | Collapse all folders in the active pane |
| `F5` | Refresh the active pane; in Changes, fetch and reread local status |
| `F12` | Open the session error log |
| `Delete` | Delete the selected file or folder |
| `Ctrl+N` | Create a file in the selected folder |
| `Shift+Enter` | Toggle the selected folder in Explorer or Changes |
| `Ctrl+F` | Search file names in Explorer or text in Editor |
| `Ctrl+Alt+F` | Search text in all project files |
| `Ctrl+E` | Edit temporary exclusions from a project search |
| `Ctrl+S` | Save the current file |
| `Ctrl+W` | Close the current tab |
| `Shift+Tab` | Go to the next tab |
| `Ctrl+C` | Copy selected text |
| `Ctrl+V` | Paste from the system clipboard |
| `Ctrl+Z` | Undo the last change |
| `Ctrl+Shift+Z` | Redo the last change |
| `Alt+Shift+F` | Format the current document |
| `Ctrl+L` | Toggle line wrapping |
| `F4` | Toggle Markdown preview and editing |
| `Ctrl+Q` | Quit |
| `Tab` | Switch Explorer, Editor, and Changes |
| `Esc` | Close a search or dialog |

## Search and counts

- `Ctrl+F` in Explorer: type part of a name or path to filter project files, including files inside collapsed folders. Use arrows to choose one, `Enter` to open it, and `Esc` to return to the tree.
- `Ctrl+F` in Editor: type text to see local matches. Use arrows to choose one and `Enter` to move the cursor to its start.
- `Ctrl+Alt+F`: type text and press `Enter` to search the project. The first search builds an in-memory index and later searches reuse it. After results arrive, use arrows to choose one and `Enter` to open the matching line.
- `Ctrl+E` in file or project search opens session exclusions. They start from the root `.gitignore`, autocomplete patterns and folders, and allow including or excluding paths without changing `.gitignore`. `.git` is never included.
- `Ctrl+P`: run **Calculate project lines**. Explorer shows counts next to files and the footer shows the indexed total. Counts and search can be partial when the 50,000-entry index limit is reached.
- The footer shows a spinner while OEC opens, saves, creates, or deletes files, indexes, searches, counts lines, or refreshes the active pane.

## Git Changes

- Git is optional. `Ctrl+Alt+B` shows the **CHANGES** pane when the project is a Git repository. Staged files are separated into **STAGED** and the rest into **CHANGES**; use arrows to select entries and `Enter` to expand or collapse folders and open diffs.
- The header shows the branch and remote status: `up to date`, `↑N` pending push, or `↓N` pending pull. Each change is numbered and shows green added and red removed lines. A file can appear once in each group; binaries or unavailable statistics show `?`.
- `+` stages a file or all contents of a folder. `-` unstages files in **STAGED** or discards **CHANGES** after confirmation.
- Move down from the last change to write the commit message; `Enter` creates the commit. `F6` pulls and `F7` pushes.
- With **CHANGES** active, `F5` runs `git fetch` and rereads local changes and statistics even when fetch fails.
- OEC displays the remote status available locally. The palette includes **Refresh Git remote references** to run `git fetch --quiet` manually.
- Untracked directories expand into individual files. Opening an entry creates a read-only `Delta` tab for its staged or unstaged diff, so both can coexist for one path. Close a diff tab with `Ctrl+W`. Diffs align changed lines, highlight changed fragments, synchronize scrolling, and show overview markers. `layout.diffOrientation` accepts `auto`, `horizontal`, or `vertical`; in `auto`, `layout.diffStackBelow` selects the terminal width at which the two versions stack vertically.

## Safety limits

- All paths are validated against the selected project root; symlinks and junctions cannot escape it.
- Only UTF-8 text files are opened and processed; binaries and files containing NUL are rejected.
- Reading and analysis are limited to 2 MiB per file.
- Image previews accept PNG, JPEG, WebP, and GIF up to 16 MiB; damaged or unsupported formats are reported without closing OEC.
- Saves use a temporary file before replacing the original and preserve its line-ending convention.
- The root `.gitignore` is shown in gray in Explorer and is excluded from counts and project searches by default. Nested `.gitignore` files, `.git/info/exclude`, and global Git exclusions are not read. Temporary search exclusions can change this for the session; `.git` remains hidden and excluded.

## Development, tests, and distribution

```powershell
bun run typecheck
bun run test
bun run test:coverage
bun run build
bun run smoke:tui
```

`bun run build` generates the current platform binary. You can also run `bun run build:windows` or `bun run build:linux`. For release/package checks, use `bun run preflight`, `bun run smoke:check`, and `bun run pack:check`. CI runs configured coverage thresholds and starts the compiled executable through its first frame. npm publishing validates versions, package contents, and binaries before distributing the platform-specific packages. See `AGENTS.md` for architecture and maintenance guidance.
