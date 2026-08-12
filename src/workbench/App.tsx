/** @jsxImportSource @opentui/solid */
import { AppLayout } from "./AppLayout"
import { useWorkbench } from "./useWorkbench"

export function App(props: { root: string }) {
  return <AppLayout {...useWorkbench(props.root)} />
}
