# Plugin OEC para OpenCode 2

- Este paquete es una integración opcional. No importar su código desde `src/` ni modificar OpenCode.
- Usar únicamente APIs públicas V2 y tipos reales de `@opencode/plugin/tui/context`.
- Nunca crear/destruir el renderer anfitrión ni llamar `process.exit` desde el plugin.
- `localRoot` requiere opt-in explícito. No inferir acceso local a partir de una ubicación remota.
- Los documentos viven fuera de las rutas JSX. Desmontar una vista no equivale a cerrar archivos.
- Usar los helpers de `src/documents/files.ts` para archivos del proyecto. Guardar borradores mediante storage del anfitrión, sin escribirlos en el proyecto.
- El enrutamiento de teclas del editor vive en `workbench/useKeyboardShortcuts.ts`; las teclas del árbol se limitan al renderable enfocado. No añadir listeners globales con `useKeyboard`.
- Mantener confirmaciones, comparación antes de guardar y detección de archivos eliminados. Nunca recrearlos automáticamente.
- El build incluye los módulos OEC compartidos, pero deja OpenCode, OpenTUI y Solid externos para usar las instancias del anfitrión.
- Verificar desde la raíz: `bun run typecheck`, `bun run test`, `bun run build`, `bun run plugin:build`.
- `scripts/smoke-host.ts` usa una instancia privada y datos temporales; no debe tocar configuración, credenciales o sesiones del usuario.
