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
  index.tsx                 Entrada de compatibilidad y configuración del renderer.
  bootstrap/
    resolve-root.ts          Resolución de la carpeta inicial.
  workbench/
    App.tsx                  Punto de composición de la aplicación.
    AppLayout.tsx            Estructura visual del workbench.
    useWorkbench.ts          Conecta capacidades y estado transversal mínimo.
    useKeyboardShortcuts.ts  Prioridad y enrutamiento de todos los atajos.
    types.ts                 Tipos compartidos de foco, overlays y acciones pendientes.
  documents/
    DocumentTabs.tsx         Barra de pestañas abiertas.
    useDocuments.ts          Pestañas, apertura, guardado, cierre y estado modificado.
    types.ts                 Tipo de pestaña abierta.
    files.ts                 Lectura, creación y guardado seguro.
  explorer/
    ExplorerPane.tsx         Panel visual del árbol de proyecto.
    useExplorer.ts           Selección, expansión y actualización del árbol.
    tree.ts                  Árbol de carpetas y rutas visibles.
    gitignore.ts             Reglas de .gitignore.
  editor/
    EditorPane.tsx           Textarea, líneas y scrollbar del editor.
    FindPanel.tsx            Búsqueda local y lista de coincidencias.
    find.ts                  Cálculo puro de coincidencias locales.
    useEditor.ts             Contenido, foco, portapapeles, wrap y deshacer/rehacer.
    useEditorMetrics.ts      Métricas, scroll y resaltado diferido del editor.
    clipboard.ts            Lectura del portapapeles de Windows.
    keyboard.ts              Detección de modificadores nativos de Windows.
    syntax.ts               Estilos y resaltado por línea.
  search/
    useSearch.ts             Paleta, búsquedas, resultados y conteo de líneas.
    file-index.ts            Índice de archivos y búsqueda difusa.
    project-search.ts        Conteo de líneas y búsqueda global.
  dialogs/
    Overlays.tsx             Paleta, búsquedas, archivo nuevo y confirmación.
    useOverlays.ts           Estado y ciclo de vida de superposiciones.
tests/                      Pruebas Bun y renderer de OpenTUI.
```

## Límites de arquitectura

- La estructura expresa capacidades del producto: `documents`, `explorer`, `editor`, `search` y `dialogs`; no crees carpetas genéricas de utilidades para lógica de una sola capacidad.
- `workbench/App.tsx` solo compone `useWorkbench` y `AppLayout`; no contiene estado de producto ni lógica de capacidades.
- `workbench/useWorkbench.ts` conecta capacidades mediante callbacks. Los paneles reciben estado y callbacks por props; no deben importar otra capacidad para ejecutar una acción.
- `workbench/useKeyboardShortcuts.ts` es el único dueño de la prioridad y el enrutamiento de teclado.
- Los módulos de infraestructura de cada capacidad no deben depender de OpenTUI. La UI de OpenTUI queda en componentes `*.tsx`.
- Si una responsabilidad transversal crece, extráela junto a la capacidad que la posee (`documents`, `explorer`, etc.), no la reincorpores en el workbench.
- Las entradas de la aplicación solo arrancan el renderer y resuelven la raíz; no contienen estado de producto.

## Reglas de implementación

- Conserva la aplicación funcional con teclado; no dependas de interacción con ratón.
- Las superposiciones deben capturar sus teclas antes de atajos globales. El modal `confirm` tiene prioridad absoluta para evitar que el editor o explorador procese flechas y combinaciones.
- Un editor sin `filePath` nunca está modificado. Mantén esta invariante al cambiar el estado de pestañas o limpiar el textarea.
- Al añadir una pestaña o cambiar de pestaña, sincroniza el contenido actual con `syncActiveTab()` antes de cargar la siguiente.
- El resaltado de `src/editor/syntax.ts` usa rangos relativos a cada línea mediante `addHighlight`. No vuelvas a usar rangos globales: causan artefactos visuales en OpenTUI.
- El explorador debe mantener visible la selección con el `ScrollBoxRenderable`. Si cambias las filas, conserva IDs o el scroll programático.
- Usa los helpers de `documents/files.ts` para accesos de archivos. No escribas directamente fuera de esos helpers.
- Las rutas siempre deben permanecer dentro de la raíz del proyecto mediante `ensureInsideRoot`.
- No sobrescribas un archivo al crearlo; `createTextFile` usa el flag exclusivo `wx`.
- Mantén los límites de 2 MB, el rechazo de binarios, la exclusión de `.git` y el respeto de `.gitignore` para el conteo y la búsqueda global.

## Atajos reservados

No reasignes estos atajos sin actualizar `README.md`, la paleta y las pruebas correspondientes:

- `Ctrl+P`: paleta.
- `Ctrl+B`: explorador.
- `F5`: actualizar el explorador de archivos.
- `Supr`: eliminar el archivo o carpeta seleccionado tras confirmar.
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
