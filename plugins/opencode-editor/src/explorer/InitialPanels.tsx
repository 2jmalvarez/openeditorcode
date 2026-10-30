/** @jsxImportSource @opentui/solid */
import type { Context } from "@opencode/plugin/tui/context"
import { FilesToggle } from "./FilesToggle"
import { createTranslator } from "../localization"
import { parsePreferences } from "../integration/options"

/** Headers only: rendering a session must not grant local filesystem access. */
export function InitialPanels(props: { context: Context; openFiles: () => void; openDiff: () => void }) {
  const t = createTranslator(parsePreferences(props.context.options).language)
  return <box flexDirection="column" flexShrink={0}>
    <FilesToggle context={props.context} label={`▸ ${t("Files")}`} toggle={props.openFiles} onNext={() => props.context.renderer.root.findDescendantById("oec-diff-toggle")?.focus()} />
    <box height={1} flexShrink={0} />
    <FilesToggle context={props.context} id="oec-diff-toggle" label={`▸ ${t("Diff")}`} toggle={props.openDiff} onExit={() => props.context.renderer.root.findDescendantById("oec-files-toggle")?.focus()} />
  </box>
}
