# Manual de OpenEditorCode

Referencia para la release **0.2.23**.

## Propósito y uso

OpenEditorCode (OEC) es un editor de proyectos para terminal. No necesita servidor ni OpenCode. Use `oec [PROYECTO]`; sin argumento abre el directorio actual. `openeditorcode` es un alias equivalente. `-h` y `--help` muestran ayuda; `-v`, `-V` y `--version` imprimen la version instalada sin iniciar la interfaz, con ambos aliases. En Unix también está disponible `man oec` tras instalar el paquete npm global.

La raíz del proyecto delimita el explorador, las búsquedas, Git y los accesos a archivos del proyecto. OEC rechaza rutas, enlaces simbólicos y junctions que salen físicamente de esa raíz.

## Instalacion y desinstalacion

Para Windows x64 o Linux x64 con glibc, con Node.js 18+ y npm:

```bash
npm install -g openeditorcode
```

El aviso de instalacion usa el idioma del sistema operativo: espanol (`es`) para variantes espanolas e ingles (`en`) para el resto. npm puede ocultar la salida de scripts lifecycle; `npm install -g openeditorcode --foreground-scripts` permite verla. `--ignore-scripts` impide ejecutar el aviso. Para desinstalar este metodo, use `npm uninstall -g openeditorcode`.

La alternativa directa esta disponible desde **0.2.23** y solo admite Linux x64 con glibc, incluido WSL con una distribucion compatible. Requiere Bash, curl y utilidades estandar de Linux como `sha256sum`; no requiere Node.js, npm ni Bun. No admite Windows nativo, macOS ni ARM64. Verifica el checksum SHA-256 y la version informada por el binario antes de instalarlo. Sus mensajes usan espanol para variantes espanolas e ingles para el resto.

```bash
curl -fsSL https://raw.githubusercontent.com/2jmalvarez/openeditorcode/main/install.sh | bash
```

Opciones del instalador: `--version <VERSION>` elige una release publicada y `--no-modify-path` evita modificar archivos de inicio del shell. No confunda esta opcion de version con la del editor, que solo imprime su version.

```bash
curl -fsSL https://raw.githubusercontent.com/2jmalvarez/openeditorcode/main/install.sh | bash -s -- --version <VERSION> --no-modify-path
```

Reemplace `<VERSION>` por una version de release a partir de `0.2.23`, sin los signos angulares. Sin `--version`, se instala la ultima release estable de GitHub. Los aliases `oec` y `openeditorcode` se instalan en `~/.local/bin`. Reinicie el shell tras configurar PATH o ejecute `export PATH="$HOME/.local/bin:$PATH"` en Bash/Zsh para la sesion actual. Con `--no-modify-path`, configure PATH manualmente si es necesario.

Cierre OEC y repita el instalador para actualizar la misma instalacion directa, sin ejecutar npm ni crear una segunda instalacion npm. Evite mezclar metodos para no tener comandos en conflicto en PATH. Desinstale los aliases directos y su marcador de propiedad con `rm -f "$HOME/.local/bin/oec" "$HOME/.local/bin/openeditorcode" "$HOME/.local/bin/.oec-install-sh.sha256"` y retire la entrada PATH agregada por el instalador del archivo de inicio del shell solo si ya no la necesita. Ambos metodos conservan la configuracion del usuario al desinstalar.

## Paneles, pestañas y editor

El explorador se muestra inicialmente. Cambios se muestra también si el ancho del terminal alcanza `explorerWidth + changesWidth + minEditorWidth`; con la configuración de fábrica son 144 columnas. En espacios menores, los paneles laterales son excluyentes para no cubrir el editor.

`Ctrl+B` alterna Explorador; `Ctrl+Alt+B` alterna Cambios; `Ctrl+Shift+Left` y `Ctrl+Shift+Right` mueven el foco. `Tab` recorre los paneles. El explorador se controla con flechas y `Enter`; `Shift+Enter` contrae la carpeta y `Ctrl+Shift+Enter` contrae el árbol. `Supr` pide confirmación antes de eliminar.

Los archivos abiertos se muestran en pestañas. `*` significa que el contenido difiere del último guardado. `Ctrl+S` guarda, `Ctrl+W` cierra y `Shift+Tab` selecciona la siguiente pestaña. Al cerrar, salir o actualizar con cambios sin guardar OEC pide guardar o descartar. Los diffs Git (`Delta`) son de solo lectura.

El editor ofrece ajuste de línea (`Ctrl+L`), formateo (`Alt+Shift+F`), deshacer (`Ctrl+Z`), rehacer (`Ctrl+Shift+Z`), copia OSC 52 (`Ctrl+C`) y pegado (`Ctrl+V`). Resalta TS, TSX, JS, JSX, JSON, CSS, HTML, Markdown, Python, YAML y shell hasta 200.000 caracteres.

## Búsqueda y rutas ignoradas

`Ctrl+F` es contextual. En Explorador hace coincidencia difusa, sin distinción de mayúsculas, contra rutas relativas y devuelve como máximo 80 archivos. En Editor busca texto literal sin distinguir mayúsculas, hasta 100 resultados. `Ctrl+Alt+F` busca texto literal por línea en todo el proyecto, hasta 100 resultados, y reutiliza un índice de hasta 50.000 entradas. `Esc` cierra las búsquedas; la búsqueda global conserva resultados al abrirlos y los limpia con `Esc`.

La raíz `.gitignore` se interpreta con sintaxis Git. `.git` siempre queda oculto y excluido. Los elementos ignorados se muestran atenuados en el explorador, pero se excluyen de búsquedas, conteos y el índice. OEC no carga `.gitignore` anidados, `.git/info/exclude` ni exclusiones globales de Git. `Ctrl+E` desde una búsqueda abre exclusiones **temporales**: no modifica `.gitignore` ni se guarda en la configuración.

La paleta incluye “Calcular líneas del proyecto”; el conteo usa las reglas base de `.gitignore` y solo texto legible.

## Git y actualizaciones

Git es opcional. Cambios muestra áreas STAGED y CAMBIOS, estadísticas `+/-` y diffs. El encabezado muestra la rama y su sincronización: `actualizado`, `↑N` pendiente de push o `↓N` pendiente de pull. `Enter` expande o contrae carpetas y abre diffs; `+` suma un archivo o toda una carpeta a STAGED y `-` quita cambios preparados o descarta cambios pendientes tras confirmar. Baja con `↓` desde el último cambio para escribir el mensaje de commit y pulsa `Enter` para confirmarlo. `F6` ejecuta pull, `F7` push y `F5` ejecuta `git fetch --quiet` antes de releer el estado local. El fetch puede desactivarse desde configuración. OEC puede vigilar cambios locales con una demora corta; también puede desactivarse.

OEC consulta npm al iniciar solo cuando se inicio con el lanzador npm, salvo que `updates.checkOnStartup` sea falso. Si encuentra una version nueva, la muestra y ofrece la actualizacion interactiva en la paleta: cierra el editor, instala el paquete npm mas reciente y reabre el proyecto. Conserva la carpeta de proyecto y toda la configuración de usuario, porque ésta nunca se guarda en el directorio de instalación. Los binarios directos no consultan npm ni ofrecen esa accion; para actualizarlos, cierre OEC y repita el instalador directo. No se crea una instalacion npm adicional.

### Historial, ramas y diffs

Con foco en Git, `F8` abre el historial completo de la rama actual en el panel derecho, cargado por paginas al navegar y sin limite total de commits. `F9` lista las ramas locales y remotas conocidas; las remotas son referencias locales, no una consulta en vivo al servidor.

`Enter` sobre una rama abre sus commits sin checkout; sobre un commit abre sus archivos modificados; sobre un archivo abre un diff historico de solo lectura en una pestana, manteniendo el panel derecho. Con foco en Git, `Esc` vuelve de archivos a historial, luego a ramas si se llego desde esa lista y finalmente a cambios locales. Las pestanas diff abiertas se conservan.

Las mutaciones Git (stage, unstage, descarte, commit, pull y push) solo estan disponibles en cambios locales y se bloquean al navegar historial o ramas. `F5` relee el estado local incluso si falla fetch y refresca el historial o la lista de ramas cuando corresponde, sin volver a cambios locales. `git.fetchOnRefresh: false` omite fetch, no las lecturas locales.

En un diff local, staged o historico, `F4` abre el archivo actual del proyecto sin cerrar el diff. No abre ni restaura la version historica. Si el archivo no existe, muestra un aviso y no lo recrea. Fuera de diffs conserva la alternancia de preview/edicion de Markdown; el manual permanece de solo lectura.

La paleta `Ctrl+P` incluye **Git: ver historial de commits** (`F8`), **Git: ver todas las ramas** (`F9`) y, con un diff activo, **Abrir archivo del proyecto** (`F4`).

## Configuración

La paleta ofrece **Abrir configuración**: una pantalla TUI para las preferencias habituales. Use `↑/↓` para seleccionar, `Enter` para cambiar, `←/→` para alternar entre el ámbito global y proyecto, `E` para abrir el JSON avanzado y `Esc` para cerrar. La configuración global está en `%APPDATA%\\openeditorcode\\config.json` en Windows y `${XDG_CONFIG_HOME:-~/.config}/openeditorcode/config.json` en Linux. `.oec/config.json` puede sobrescribir valores para el proyecto abierto. `OEC_CONFIG_DIR` permite elegir otro directorio para pruebas o instalaciones administradas.

El formato exacto se define en `docs/oec-config.schema.json`. Claves desconocidas, JSON inválido, versiones de esquema no compatibles o valores fuera de rango son incompatibles. El archivo de fábrica es:

`preview.markdownDefault` controla si Markdown abre en preview (valor de fábrica) o fuente; `preview.images` habilita previews de PNG, JPEG, WebP y GIF; `preview.imageProtocol` permite `auto`, `kitty`, `sixel` o `blocks`. `F4` alterna fuente y preview de los Markdown del proyecto. El manual siempre usa preview y es de solo lectura.

```json
{
  "schemaVersion": 3,
  "appearance": { "theme": "oec-dark", "language": "auto" },
  "layout": { "explorerWidth": 40, "changesWidth": 44, "minEditorWidth": 60, "explorerStartup": "visible", "changesStartup": "auto", "narrowSidePanels": "single", "findPanelMaxWidth": 48, "diffOrientation": "auto", "diffStackBelow": 120 },
  "editor": { "wrap": "none", "lineNumbers": true, "syntax": { "enabled": true, "styles": { "default": { "foreground": "#d6e5dc" }, "keyword": { "foreground": "#79c0ff", "bold": true }, "string": { "foreground": "#a5d6a7" }, "comment": { "foreground": "#7d8590", "italic": true, "dim": true }, "number": { "foreground": "#e3b341" }, "tag": { "foreground": "#ffab70", "bold": true }, "property": { "foreground": "#d2a8ff" } } }, "formatting": { "formatOnSave": false, "defaultFormatter": "prettier", "byExtension": { ".ts": "prettier" }, "prettier": { "printWidth": 100, "tabWidth": 2, "useTabs": false, "semi": true, "singleQuote": false } } },
  "keyboard": { "profile": "default", "bindings": { "editor.formatDocument": ["alt+shift+f"] } },
  "formatters": { "external": {} },
  "search": { "respectGitignore": true },
  "git": { "autoRefresh": true, "fetchOnRefresh": true },
  "updates": { "checkOnStartup": true },
  "preview": { "markdownDefault": "preview", "images": true, "imageProtocol": "auto" }
}
```

`editor.syntax.styles` permite personalizar los colores y atributos de `default`, `keyword`, `string`, `comment`, `number`, `tag` y `property`. Prettier formatea JS, TS, JSON, CSS, HTML, Markdown y YAML. Formateadores externos se declaran globalmente y se seleccionan por extensión; un proyecto no puede declarar ejecutables. `keyboard.bindings` sobrescribe atajos por identificador de comando y `keyboard.profile: "vim"` habilita modos Normal, Insert y Visual básicos.

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
| `F4` | En diff, abrir archivo actual del proyecto sin cerrar el diff; fuera de diffs, alternar preview/edicion de Markdown |
| `F5` | Actualizar panel activo; en Git, fetch, lectura local y refresco historico cuando corresponde |
| `F8` / `F9` | Con foco en Git, historial completo paginado / ramas locales y remotas conocidas |
| `F12` | Abrir el registro de errores de la sesión |
| `Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+Shift+Z` | Copiar, pegar, deshacer, rehacer |
| `Esc` | Cerrar busqueda o dialogo; con foco en historial Git, retroceder hacia cambios locales sin cerrar diffs |

Los overlays tienen prioridad sobre los atajos globales. En confirmaciones use flechas y `Enter`; en resultados use flechas y `Enter`.

## Registro de errores

Si falla una operación de Git, archivos u otro servicio del editor, el pie indica `F12`. Ese atajo abre una pestaña central de solo lectura con la operación, hora y detalle técnico. El registro se conserva solo durante la sesión.
