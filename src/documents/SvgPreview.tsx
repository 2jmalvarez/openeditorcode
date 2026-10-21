/** @jsxImportSource @opentui/solid */
import { createResource, Show, type Accessor } from "solid-js"
import type { ImageRenderProtocol } from "@opentui/core"
import { ImagePreview } from "./ImagePreview"
import { renderSvg } from "./svg"
import { t } from "../localization"

export function SvgPreview(props: { content: Accessor<string>; active: Accessor<boolean>; protocol: Accessor<ImageRenderProtocol> }) {
  // Resolve errors as data so malformed SVG never escapes to the workbench.
  const [result] = createResource(props.content, async (source) => {
    try { return { bytes: await renderSvg(source) } }
    catch { return { bytes: undefined } }
  })
  return <Show when={!result.loading && result()?.bytes} fallback={<box style={{ flexGrow: 1, minHeight: 0, flexDirection: "column", backgroundColor: "#101419" }}>
    <box style={{ height: 1, paddingX: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#8ca0ae">{t("preview.svg")}</text></box>
    <text fg={result.loading ? "#8ca0ae" : "#ef7b7b"}>{t(result.loading ? "preview.svgLoading" : "preview.svgFailed")}</text>
  </box>}>
    <ImagePreview bytes={() => result()?.bytes} active={props.active} protocol={props.protocol} label={t("preview.svg")} />
  </Show>
}
