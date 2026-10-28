/** @jsxImportSource @opentui/solid */
import { basename } from "node:path"
import { For } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { isDirty } from "./workspace"
import { usePointer } from "../../../../src/ui/usePointer"

export function DocumentTabs(props: { controller: EditorController; onFocus: () => void }) {
  const { controller } = props
  const pointer = usePointer(() => !controller.modal)
  const revision = useRevision(controller.workspace)
  return <box flexShrink={0} flexDirection="row" flexWrap="wrap" backgroundColor={controller.context.theme.background.raised.base}>
    <For each={(() => { revision(); return [...controller.workspace.documents] })()}>{(document) =>
      <box id={`oec-document-tab:${document.path}`} {...pointer} paddingX={1} flexShrink={0} flexDirection="row" onMouseDown={(event) => {
        if (controller.modal) return
        if (event.button === 1) { event.preventDefault(); event.stopPropagation(); void controller.run(() => controller.close(document.path)) }
        else if (event.button === 0) { controller.activate(document.path); props.onFocus() }
      }}>
        <text fg={(() => { revision(); return controller.workspace.activePath === document.path ? controller.context.theme.text.base : controller.context.theme.text.muted })()}>
          {(() => { revision(); return `${document.kind === "diff" ? `Δ ${document.area === "staged" ? "staged: " : ""}` : document.kind === "image" ? "▣ " : isDirty(document) ? "* " : ""}${basename(document.targetPath ?? document.path)}` })()}
        </text>
        <text {...pointer} fg={controller.context.theme.text.muted} onMouseDown={(event) => { event.stopPropagation(); if (!controller.modal && (event.button === 0 || event.button === 1)) { event.preventDefault(); void controller.run(() => controller.close(document.path)) } }}> ×</text>
      </box>
    }</For>
  </box>
}
