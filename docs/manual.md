# Manual de OpenEditorCode

## Propósito y uso

OpenEditorCode (OEC) es un editor de proyectos para terminal. No necesita servidor ni OpenCode. Use `oec [PROYECTO]`; sin argumento abre el directorio actual. `oec --help` y `oec --version` describen la interfaz de línea de comandos. En Unix también está disponible `man oec` tras instalar el paquete npm global.

La raíz del proyecto delimita el explorador, las búsquedas, Git y los accesos a archivos del proyecto. OEC rechaza rutas, enlaces simbólicos y junctions que salen físicamente de esa raíz.

## Paneles, pestañas y editor

El explorador se muestra inicialmente. Cambios se muestra también si el ancho del terminal alcanza `explorerWidth + changesWidth + minEditorWidth`; con la configuración de fábrica son 144 columnas. En espacios menores, los paneles laterales son excluyentes para no cubrir el editor.

`Ctrl+B` alterna Explorador; `Ctrl+Alt+B` alterna Cambios; `Ctrl+Shift+Left` y `Ctrl+Shift+Right` mueven el foco. `Tab` recorre los paneles. El explorador se controla con flechas y `Enter`; `Shift+Enter` contrae la carpeta y `Ctrl+Shift+Enter` contrae el árbol. `Supr` pide confirmación antes de eliminar.

Los archivos abiertos se muestran en pestañas. `*` significa que el contenido difiere del último guardado. `Ctrl+S` guarda, `Ctrl+W` cierra y `Shift+Tab` selecciona la siguiente pestaña. Al cerrar, salir o actualizar con cambios sin guardar OEC pide guardar o descartar. Los diffs Git (`Delta`) son de solo lectura.

El editor ofrece ajuste de línea (`Ctrl+L` o `Ctrl+Alt+W`), deshacer (`Ctrl+Z`), rehacer (`Ctrl+Shift+Z`), copia OSC 52 (`Ctrl+C`) y pegado (`Ctrl+V`). Resalta TS, TSX, JS, JSX, JSON, CSS, HTML, Markdown, Python, YAML y shell hasta 200.000 caracteres.

## Búsqueda y rutas ignoradas

`Ctrl+F` es contextual. En Explorador hace coincidencia difusa, sin distinción de mayúsculas, contra rutas relativas y devuelve como máximo 80 archivos. En Editor busca texto literal sin distinguir mayúsculas, hasta 100 resultados. `Ctrl+Alt+F` busca texto literal por línea en todo el proyecto, hasta 100 resultados, y reutiliza un índice de hasta 50.000 entradas. `Esc` cierra las búsquedas; la búsqueda global conserva resultados al abrirlos y los limpia con `Esc`.

La raíz `.gitignore` se interpreta con sintaxis Git. `.git` siempre queda oculto y excluido. Los elementos ignorados se muestran atenuados en el explorador, pero se excluyen de búsquedas, conteos y el índice. OEC no carga `.gitignore` anidados, `.git/info/exclude` ni exclusiones globales de Git. `Ctrl+E` desde una búsqueda abre exclusiones **temporales**: no modifica `.gitignore` ni se guarda en la configuración.

La paleta incluye “Calcular líneas del proyecto”; el conteo usa las reglas base de `.gitignore` y solo texto legible.

## Git y actualizaciones

Git es opcional. Cambios muestra áreas STAGED y CAMBIOS, estadísticas `+/-` y diffs. El encabezado muestra la rama y su sincronización: `actualizado`, `↑N` pendiente de push o `↓N` pendiente de pull. `Enter` expande o contrae carpetas y abre diffs; `+` suma un archivo o toda una carpeta a STAGED y `-` quita cambios preparados o descarta cambios pendientes tras confirmar. Baja con `↓` desde el último cambio para escribir el mensaje de commit y pulsa `Enter` para confirmarlo. `F6` ejecuta pull, `F7` push y `F5` ejecuta `git fetch --quiet` antes de releer el estado local. El fetch puede desactivarse desde configuración. OEC puede vigilar cambios locales con una demora corta; también puede desactivarse.

OEC consulta npm al iniciar, salvo que `updates.checkOnStartup` sea falso. La actualización interactiva solo está disponible cuando se inició con el lanzador npm. Conserva la carpeta de proyecto y toda la configuración de usuario, porque ésta nunca se guarda en el directorio de instalación.

## Configuración

La paleta ofrece **Editar configuración de OEC**. El archivo se abre como un documento autorizado externo y se valida al guardar. Está en `%APPDATA%\\openeditorcode\\config.json` en Windows y `${XDG_CONFIG_HOME:-~/.config}/openeditorcode/config.json` en Linux. `OEC_CONFIG_DIR` permite elegir otro directorio para pruebas o instalaciones administradas.

El formato exacto se define en `docs/oec-config.schema.json`. Claves desconocidas, JSON inválido, versiones de esquema no compatibles o valores fuera de rango son incompatibles. El archivo de fábrica es:

`preview.markdownDefault` controla si Markdown abre en preview (valor de fábrica) o fuente; `preview.images` habilita previews de PNG, JPEG, WebP y GIF; `preview.imageProtocol` permite `auto`, `kitty`, `sixel` o `blocks`. `F4` alterna fuente y preview de los Markdown del proyecto. El manual siempre usa preview y es de solo lectura.

```json
{
  "schemaVersion": 2,
  "appearance": { "theme": "oec-dark", "language": "auto" },
  "layout": { "explorerWidth": 40, "changesWidth": 44, "minEditorWidth": 60, "explorerStartup": "visible", "changesStartup": "auto", "narrowSidePanels": "single", "findPanelMaxWidth": 48, "diffOrientation": "auto", "diffStackBelow": 120 },
  "editor": { "wrap": "none", "lineNumbers": true, "syntaxHighlighting": true },
  "search": { "respectGitignore": true },
  "git": { "autoRefresh": true, "fetchOnRefresh": true },
  "updates": { "checkOnStartup": true },
  "preview": { "markdownDefault": "preview", "images": true, "imageProtocol": "auto" }
}
```

Las escrituras son atómicas. Si el archivo no se puede interpretar, o si OEC termina anormalmente antes de completar un primer frame con una configuración en prueba, OEC reemplaza `config.bkp.json` con el archivo problemático, restaura `config.json` a fábrica y relanza una única vez. El backup siempre se sobrescribe, no se rota. El siguiente inicio muestra la ruta del backup. Si también falla con fábrica, OEC no entra en un bucle y conserva el backup.

`appearance.language` acepta `"auto"`, `"es"` o `"en"`. `"auto"` usa el idioma del sistema operativo: las variantes españolas usan español y cualquier idioma no soportado usa inglés. El valor explícito se aplica inmediatamente al guardar la configuración.

La paleta también ofrece **Abrir manual de OEC**. El documento distribuido y esta pestaña describen la misma especificación.

## Límites y seguridad

Solo se editan archivos UTF-8 de hasta 2 MiB (2.097.152 bytes). Archivos con NUL, binarios, UTF-8 inválido o más grandes se rechazan. Las creaciones usan modo exclusivo y no sobrescriben. Los guardados escriben un temporal exclusivo y luego renombran. No se puede eliminar la raíz ni borrar entradas afectadas por pestañas modificadas.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl+P` | Paleta |
| `Ctrl+B` / `Ctrl+Alt+B` | Alternar Explorador / Cambios |
| `Ctrl+Shift+Left` / `Ctrl+Shift+Right` | Mover foco |
| `Ctrl+N`, `Ctrl+S`, `Ctrl+W`, `Ctrl+Q` | Crear, guardar, cerrar, salir |
| `Ctrl+F`, `Ctrl+Alt+F`, `Ctrl+E` | Buscar local/contextual, proyecto, exclusiones temporales |
| `F5` | Actualizar panel activo |
| `Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+Shift+Z` | Copiar, pegar, deshacer, rehacer |
| `Esc` | Cerrar búsqueda o diálogo |

Los overlays tienen prioridad sobre los atajos globales. En confirmaciones use flechas y `Enter`; en resultados use flechas y `Enter`.
