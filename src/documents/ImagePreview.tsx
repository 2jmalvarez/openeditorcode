/** @jsxImportSource @opentui/solid */
import { createEffect, createSignal, on, Show, type Accessor } from "solid-js"
import type { ImageRenderProtocol } from "@opentui/core"
import { t } from "../localization"

export function ImagePreview(props: { bytes: Accessor<Uint8Array | undefined>; active: Accessor<boolean>; protocol: Accessor<ImageRenderProtocol>; label?: string }) {
  const [error, setError] = createSignal(false)
  createEffect(on(props.bytes, () => setError(false)))
  return <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "column", backgroundColor: "#101419" }}>
     <box style={{ height: 1, paddingX: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#8ca0ae">{props.label ?? t("preview.image")}</text></box>
    <box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0, flexDirection: "column" }}>
       <Show when={!error()} fallback={<text fg="#ef7b7b">{t("preview.imageFailed")}</text>}>
         <image id="oec-standalone-image" source={props.bytes()} fit="fit" protocol={props.protocol()} onError={() => setError(true)} style={{ width: "100%", flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }} />
       </Show>
    </box>
  </box>
}
