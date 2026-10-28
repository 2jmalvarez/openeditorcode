import type { Context } from "@opencode/plugin/tui/context"
import type { EditorController } from "./controller"
import type { EditorPreferences } from "./options"
import { nativeShortcuts } from "../workbench/native-shortcuts"

export const OEC_GROUP = "OEC: opencode-editor"

export const SHORTCUTS = `OEC shortcuts
F6 (toggleBinding): conversation/editor, preserve panel visibility
F7 (filesBinding): show/hide the entire Files section, including its header
F8 (diffBinding): show/hide Diff (visible by default)
F4: diff → current editable file; Markdown / SVG preview ↔ edit
F2 in Files: rename selected file/folder
Ctrl+E in name search: fuzzy/literal; Ctrl+F in search: name/path ↔ content
Ctrl+S: save · Ctrl+W: close · Shift+Tab: next document
Middle-click anywhere on a tab: close (confirm unsaved changes)
Tab: focus Files/Diff/editor · / in Files: focus search
Ctrl+F: find in editable file · Ctrl+L: line wrap
Ctrl+A: select all · Ctrl+C/V: clipboard
Ctrl+Z / Ctrl+Shift+Z: undo/redo
Ctrl+Enter / Ctrl+Shift+Enter: insert line below/above
Shift+Alt+↑/↓: duplicate line · Alt+↑/↓: move line
Ctrl+Shift+K: delete line · Ctrl+D: select word
Ctrl+Home/End: file start/end · Ctrl+←/→: word
Home/End: line start/end · Shift+Home/End: select to line start/end
Shift + navigation: extend selection · PageUp/Down: page
↑/↓ Enter: navigate/open Files or Diff
Enter/Space on accordion: expand/collapse
Files accordion expansion is independent from F7 visibility and is preserved when hidden
Left/Right on Files or Diff: collapse/expand; Left from a leaf: parent folder
Home/End in Files/Diff tree: first/last row; PageUp/Down: previous/next page
Wheel/scrollbar: manual scrolling; refresh keeps its position; navigation reveals selection
F5: refresh focused Files/Diff/editor
Esc: clear search, then return focus
Read-only views: arrows, Home/End, PageUp/Down
Images: PNG, JPEG, GIF, WebP; no editing
SVG: static local preview, F4 edits XML, previews unsaved changes; invalid SVG stays editable.
Content search: literal, case-insensitive, disk files, first 80 matches; ignores binaries and files above 2 MiB.
Diff: ● staged vs HEAD; ○ working tree vs index; ? untracked
Diff colors: + green, − red; ● blue staged; ○ green new, red deleted, warning modified/renamed.
Git reads disk/index, not unsaved editor buffers.
Additional textarea shortcuts (editable source only):
${nativeShortcuts.filter(({ bind }) => !["ctrl+a", "ctrl+f", "ctrl+w", "ctrl+d", "home", "end", "shift+home", "shift+end", "return", "ctrl+right", "ctrl+left", "ctrl+shift+right", "ctrl+shift+left"].includes(bind)).map(({ bind, title }) => `${bind}: ${title}`).join("\n")}`

export function configurationText(options: EditorPreferences): string {
  return `Set plugin options in global cli.json → plugins[].options (not opencode.json).
Current defaults:
${JSON.stringify(options, null, 2)}
localRoot: optional absolute local directory override; otherwise confirm active session directory.
Local access: allow for this TUI only, or remember this exact folder on this computer across restarts.
Palette: "Forget remembered folder access" removes saved permission; current documents remain open until the TUI exits.
toggleBinding: conversation/editor (default f6)
filesBinding: Files (default f7)
diffBinding: Diff (default f8), independent of filesBinding
explorerWidth: 18–60 columns
panelHeight: expanded (default, share remaining height) | compact (bounded panels)
searchMode: fuzzy (whole path, ordered letters) | literal (name contains text; paths if query contains /)
markdownPreview: true | false (default view for newly opened Markdown)
diffView: split | unified
imageProtocol: auto | blocks (portable colored-cell fallback)
drafts: { enabled: boolean, exclude: non-negated gitignore patterns }
Menu changes affect this project's current controller only. Edit cli.json for defaults after restart.
No personal configuration is written automatically.`
}

export async function showSettings(context: Context, defaults: EditorPreferences, controller?: EditorController) {
  const choose = () => context.ui.dialog.select({ title: "OEC · Configuration", options: [
    { title: "View all options and current values", value: "reference" },
    { title: `Search: ${controller?.fileSearch.mode ?? defaults.searchMode}`, value: "search", disabled: !controller },
    { title: `Markdown default: ${(controller?.options ?? defaults).markdownPreview ? "preview" : "source"}`, value: "markdown", disabled: !controller },
    { title: `Diff layout: ${(controller?.options ?? defaults).diffView}`, value: "diff", disabled: !controller },
    { title: `Panel height: ${(controller?.options ?? defaults).panelHeight}`, value: "panels", disabled: !controller },
    { title: `Image protocol: ${(controller?.options ?? defaults).imageProtocol}`, value: "image", disabled: !controller },
  ] })
  const choice = controller ? await controller.dialog(choose) : await choose()
  if (choice === "reference") {
    const show = () => context.ui.dialog.alert({ title: "OEC · Plugin options", message: configurationText(controller ? { ...controller.options, searchMode: controller.fileSearch.mode } : defaults) })
    if (controller) await controller.dialog(show); else await show()
  } else if (controller) {
    if (choice === "search") controller.toggleSearchMode()
    if (choice === "markdown") controller.toggleMarkdownDefault()
    if (choice === "diff") controller.toggleDiffView()
    if (choice === "panels") controller.togglePanelHeight()
    if (choice === "image") controller.toggleImageProtocol()
  }
}
