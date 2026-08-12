# openeditorcode: Guía Para Agentes

## Propósito

`openeditorcode` (OEC) es un editor TUI autónomo para Windows Terminal. Combina explorador de proyecto, edición de texto, pestañas, búsqueda, portapapeles y análisis de líneas. No integra OpenCode ni debe introducir dependencias de servidor.

## Stack y comandos

- Runtime: Bun `>=1.3.0`.
- UI: OpenTUI Solid (`@opentui/core`, `@opentui/solid`, `solid-js`).
- Lenguaje: TypeScript estricto.

Ejecutar estos comandos desde la raíz de este proyecto:

```powershell
bun run dev
bun run typecheck
bun run test
bun run build
```

La ejecución de desarrollo necesita el preload de OpenTUI, ya incluido en los scripts de `package.json`. No elimines ese preload. La compilación se realiza en `build.ts` y produce `dist/oec.exe`.

## Estructura

```text
src/
  index.tsx                 Entrada y configuración del renderer.
  app.tsx                   Estado principal, atajos, pestañas y UI.
  editor/
    clipboard.ts            Lectura del portapapeles de Windows.
    syntax.ts               Estilos y resaltado por línea.
  filesystem/
    files.ts                Lectura, creación y guardado seguro.
    project.ts              Conteo de líneas y búsqueda global.
    search.ts               Índice y búsqueda difusa.
    tree.ts                 Árbol de carpetas.
tests/                      Pruebas Bun y renderer de OpenTUI.
```

## Reglas de implementación

- Conserva la aplicación funcional con teclado; no dependas de interacción con ratón.
- Las superposiciones deben capturar sus teclas antes de atajos globales. El modal `confirm` tiene prioridad absoluta para evitar que el editor o explorador procese flechas y combinaciones.
- Un editor sin `filePath` nunca está modificado. Mantén esta invariante al cambiar el estado de pestañas o limpiar el textarea.
- Al añadir una pestaña o cambiar de pestaña, sincroniza el contenido actual con `syncActiveTab()` antes de cargar la siguiente.
- El resaltado de `src/editor/syntax.ts` usa rangos relativos a cada línea mediante `addHighlight`. No vuelvas a usar rangos globales: causan artefactos visuales en OpenTUI.
- El explorador debe mantener visible la selección con el `ScrollBoxRenderable`. Si cambias las filas, conserva IDs o el scroll programático.
- Usa los helpers de `filesystem/files.ts` para accesos de archivos. No escribas directamente fuera de esos helpers.
- Las rutas siempre deben permanecer dentro de la raíz del proyecto mediante `ensureInsideRoot`.
- No sobrescribas un archivo al crearlo; `createTextFile` usa el flag exclusivo `wx`.
- Mantén los límites de 2 MB, el rechazo de binarios, la exclusión de `.git` y el respeto de `.gitignore` para el conteo y la búsqueda global.

## Atajos reservados

No reasignes estos atajos sin actualizar `README.md`, la paleta y las pruebas correspondientes:

- `Ctrl+P`: paleta.
- `Ctrl+B`: explorador.
- `Ctrl+N`: archivo nuevo.
- `Ctrl+S`: guardar.
- `Ctrl+W`: cerrar pestaña.
- `Shift+Tab`: siguiente pestaña.
- `Ctrl+F`: búsqueda local.
- `Ctrl+Alt+F`: búsqueda global.
- `Shift+Enter`: contraer carpeta seleccionada en el explorador.
- `Ctrl+Shift+Enter`: contraer árbol en el explorador.
- `Ctrl+C` / `Ctrl+V`: portapapeles.
- `Ctrl+Z` / `Ctrl+Shift+Z`: deshacer y rehacer.

## Verificación requerida

Antes de finalizar una modificación de código:

1. Ejecuta `bun run typecheck`.
2. Ejecuta `bun run test`.
3. Ejecuta `bun run build` si se modifica la aplicación, el empaquetado o una dependencia.
4. Cuando arregles un defecto, añade una prueba de regresión cuando resulte práctico.

Las pruebas TUI usan `@opentui/solid` con preload. El renderer de pruebas no distingue todos los modificadores de teclas de terminal; cubre esa lógica con funciones de filesystem o estado cuando sea necesario.
