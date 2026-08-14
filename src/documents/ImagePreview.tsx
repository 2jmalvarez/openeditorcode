/** @jsxImportSource @opentui/solid */
import { createSignal, type Accessor } from "solid-js"
import type { ImageRenderProtocol } from "@opentui/core"

export function ImagePreview(props: { bytes: Accessor<Uint8Array | undefined>; active: Accessor<boolean>; protocol: Accessor<ImageRenderProtocol> }) {
  const [error, setError] = createSignal<string>()
  return <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "column", backgroundColor: "#101419" }}>
    <box style={{ height: 1, paddingX: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#8ca0ae">IMAGEN · SOLO LECTURA</text></box>
    <box style={{ flexGrow: 1, minHeight: 0, justifyContent: "center", alignItems: "center" }}>
      <image source={props.bytes()} fit="fit" protocol={props.protocol()} onError={() => setError("No se pudo mostrar esta imagen.")} style={{ flexGrow: 1, minWidth: 0, minHeight: 0 }} />
      {error() && <text fg="#ef7b7b">{error()}</text>}
    </box>
  </box>
}
