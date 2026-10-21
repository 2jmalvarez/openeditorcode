/** @jsxImportSource @opentui/solid */
import { SyntaxStyle, type BoxRenderable, type ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createResource, createSignal, onCleanup, Show } from "solid-js"
import { extname } from "node:path"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { isSvg, type Document } from "./workspace"
import { renderSvg } from "../../../../src/documents/svg"
import { MarkdownContent, markdownStyles, type MarkdownColors } from "../../../../src/documents/MarkdownContent"

// Highlight jobs may outlive a disposed pane. Share the host-theme style instead
// of destroying native style memory while an asynchronous parser still uses it.
const styles = new WeakMap<object, WeakMap<object, { plain: SyntaxStyle; markdown: SyntaxStyle }>>()
function markdownColors(controller: EditorController): MarkdownColors {
  const { theme, themeMode } = controller.context
  return { text: theme.text.base, muted: theme.text.muted, surface: theme.background.raised.base, light: themeMode === "light" }
}
function themeStyle(controller: EditorController) {
  const { theme, renderer } = controller.context
  let themes = styles.get(renderer)
  if (!themes) {
    themes = new WeakMap()
    styles.set(renderer, themes)
  }
  let style = themes.get(theme)
  if (!style) {
    const plain = SyntaxStyle.fromStyles({
      default: { fg: theme.text.base }, "markup.heading": { fg: theme.text.base, bold: true },
      "markup.strong": { fg: theme.text.base, bold: true }, "markup.italic": { fg: theme.text.base, italic: true },
      comment: { fg: theme.text.muted, italic: true },
    }, renderer.nativeScene)
    style = { plain, markdown: SyntaxStyle.fromStyles(markdownStyles(markdownColors(controller)), renderer.nativeScene) }
    themes.set(theme, style)
  }
  return style
}

export function ReadOnlyPane(props: { controller: EditorController; document: Document; focused: () => boolean; onFocus: () => void }) {
  const { controller, document } = props
  const revision = useRevision(controller.workspace)
  const status = useRevision(controller)
  const content = () => { revision(); return document.content }
  const options = () => { status(); return controller.options }
  const svg = () => isSvg(document.path) && (!document.kind || document.kind === "file")
  const [raster] = createResource(() => svg() ? content() : false, async (source) => {
    try { return await renderSvg(source) } catch { return undefined }
  })
  const [imageError, setImageError] = createSignal("")
  let panel: BoxRenderable | undefined
  let scroll: ScrollBoxRenderable | undefined
  const style = themeStyle(controller)
  const markdown = () => document.kind !== "diff" && document.kind !== "image"
  const remember = () => {
    if (scroll && !scroll.isDestroyed) controller.workspace.remember(document.path, { ...document.position, scrollY: scroll.scrollTop, scrollX: scroll.scrollLeft })
  }
  onCleanup(remember)
  createEffect(() => { if (props.focused()) panel?.focus(); else panel?.blur() })
  controller.context.keymap.layer(() => ({ mode: "oec-editor", target: () => panel, priority: 45,
    enabled: props.focused() && !controller.modal, commands: [
      ...[["up", -1], ["down", 1], ["pageup", -10], ["pagedown", 10]] .map(([bind, delta]) => ({ bind: String(bind), run: () => { scroll?.scrollBy(Number(delta)); remember() } })),
      { bind: "home,ctrl+home", run: () => { if (scroll) scroll.scrollTop = 0; remember() } },
      { bind: "end,ctrl+end", run: () => { if (scroll) scroll.scrollTop = scroll.scrollHeight; remember() } },
      { bind: "left", run: () => { if (scroll) scroll.scrollLeft -= 4; remember() } },
      { bind: "right", run: () => { if (scroll) scroll.scrollLeft += 4; remember() } },
    ],
  }))
  const filetype = () => ({ ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".json": "json", ".md": "markdown", ".py": "python" })[extname(document.targetPath ?? document.path)]
  return <box id="oec-readonly-pane" ref={(value) => { panel = value }} focusable flexGrow={1} minHeight={0} minWidth={0} overflow="hidden" flexDirection="column"
    onMouseDown={props.onFocus}>
    <text height={1} flexShrink={0} fg={controller.context.theme.text.muted}>{document.kind === "diff" ? " Git diff · F4 edit current file · read-only" : svg() ? " SVG preview · F4 edit XML" : document.kind === "image" ? " Image · read-only · OEC settings: image protocol" : document.kind === "help" ? " OEC · reference · read-only" : " Markdown preview · F4 edit"}</text>
    <Show when={document.kind === "image" || svg()} fallback={
      <scrollbox ref={(value) => { scroll = value; value.scrollTop = document.position.scrollY; value.scrollLeft = document.position.scrollX }} flexGrow={1} minHeight={0} minWidth={0} scrollY scrollX={!markdown()} viewportOptions={{ overflow: "hidden" }}
        contentOptions={{ paddingLeft: markdown() ? 2 : 0, paddingRight: markdown() ? 2 : 0, paddingTop: markdown() ? 1 : 0, paddingBottom: markdown() ? 1 : 0 }}>
        <Show when={document.kind === "diff"} fallback={<MarkdownContent id="oec-markdown-preview" content={content()} syntaxStyle={style.markdown} colors={markdownColors(controller)} />}>
          <Show when={/^@@ /m.test(content())} fallback={<text fg={controller.context.theme.text.muted}>{content().trim() || "No textual changes (empty file or change already resolved)."}</text>}>
            <diff id="oec-diff-view" diff={content()} view={options().diffView} syncScroll showLineNumbers filetype={filetype()} syntaxStyle={style.plain} wrapMode="word" />
          </Show>
        </Show>
      </scrollbox>
    }>
      <Show when={!imageError() && (!svg() || raster())} fallback={<text fg={controller.context.theme.text.muted}>{svg() ? raster.loading ? " Rendering SVG…" : " Cannot display SVG. F4 to edit XML." : ` Cannot display image: ${imageError()}. Supported: PNG, JPEG, GIF, WebP.`}</text>}>
        <image id="oec-image-preview" source={svg() ? raster() : document.bytes} fit="fit" protocol={options().imageProtocol} flexGrow={1} minWidth={0} minHeight={0} onError={(error) => setImageError(error instanceof Error ? error.message : String(error))} />
      </Show>
    </Show>
  </box>
}
