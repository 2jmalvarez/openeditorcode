/** @jsxImportSource @opentui/solid */
import { AppLayout } from "./AppLayout"
import { useWorkbench } from "./useWorkbench"
import type { ConfigPaths, OecConfig, ConfigRecovery } from "../config/types"
import { factoryConfig } from "../config/defaults"
import { configPaths as defaultConfigPaths } from "../config/storage"

export function App(props: { root: string; config?: OecConfig; configPaths?: ConfigPaths; recovery?: ConfigRecovery }) {
  return <AppLayout {...useWorkbench(props.root, props.config ?? factoryConfig(), props.configPaths ?? defaultConfigPaths(), props.recovery)} />
}
