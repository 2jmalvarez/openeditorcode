# Plugin OEC para OpenCode 2

- Este paquete es una integración opcional. No importar su código desde `src/` ni modificar OpenCode.
- Usar únicamente APIs públicas V2 y tipos reales de `@opencode/plugin/tui/context`.
- Nunca crear/destruir el renderer anfitrión ni llamar `process.exit` desde el plugin.
- Por defecto resolver la carpeta de la sesión activa (en inicio, location/default) y confirmar acceso al disco local antes de leerla, salvo permiso recordado explícitamente para esa carpeta exacta y equipo/usuario. Ofrecer autorización solo por TUI, recordar o denegar; permitir olvidar permisos sin perder documentos abiertos (se pregunta de nuevo tras reiniciar). `localRoot` es un override opcional con opt-in explícito. No inferir acceso local a partir de una ubicación remota; workspaces remotos requieren override explícito incluso con permiso recordado. Mantener un controller independiente por raíz, sin mezclar documentos ni borradores.
- Los documentos viven fuera de las rutas JSX. Desmontar una vista no equivale a cerrar archivos.
- Usar los helpers de `src/documents/files.ts` para archivos del proyecto. Guardar borradores mediante storage del anfitrión, sin escribirlos en el proyecto.
- El enrutamiento de teclas del editor vive en `workbench/useKeyboardShortcuts.ts`; las teclas del árbol se limitan al renderable enfocado. No añadir listeners globales con `useKeyboard`.
- Mantener confirmaciones, comparación antes de guardar y detección de archivos eliminados. Nunca recrearlos automáticamente.
- El build incluye los módulos OEC compartidos, pero deja OpenCode, OpenTUI y Solid externos para usar las instancias del anfitrión.
- SVG comparte el renderer seguro de OEC. El paquete incluye WASM, fuente y notices; las URLs se resuelven desde `import.meta.url`, no desde cwd ni rutas del checkout. F4 conserva el XML sin guardar y las confirmaciones de documento.
- Ctrl+F con foco en el buscador Files alterna nombre/contenido; en el editor mantiene búsqueda local. Contenido es literal sobre disco, cancelable, respeta ignorados y límites de texto. Fuzzy/Literal conserva su estado independiente mediante Ctrl+E.
- Expón acciones nuevas y existentes en Ctrl+P con IDs únicos, títulos y grupo `OEC: opencode-editor`, respetando foco, modales y disponibilidad. No captures atajos del chat desde acciones de paleta.
- OpenTUI 0.5 no limpia dimensiones al recibir `undefined`: usa altura explícita y flexBasis `auto` al contraer paneles o pasar a compact.
- Verificar desde la raíz: `bun run typecheck`, `bun run test`, `bun run build`, `bun run plugin:build`.
- `scripts/smoke-host.ts` usa una instancia privada y datos temporales; no debe tocar configuración, credenciales o sesiones del usuario.
