/** @jsxImportSource @opentui/solid */
import { AppLayout } from "./AppLayout"
import { useWorkbench } from "./useWorkbench"
import type { ConfigPaths, OecConfig, ConfigRecovery, ProjectConfig } from "../config/types"
import { factoryConfig } from "../config/defaults"
import { configPaths as defaultConfigPaths } from "../config/storage"

export function App(props: { root: string; config?: OecConfig; globalConfig?: OecConfig; projectConfig?: ProjectConfig; configPaths?: ConfigPaths; projectConfigPath?: string; recovery?: ConfigRecovery }) {
  return <AppLayout {...useWorkbench(props.root, props.config ?? factoryConfig(), props.configPaths ?? defaultConfigPaths(), props.recovery, props.globalConfig, props.projectConfig, props.projectConfigPath)} />
}
