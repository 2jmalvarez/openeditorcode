import type { SupportedLanguage } from "../localization"

const manuals: Record<SupportedLanguage, string> = {
  es: `# Manual de OpenEditorCode

## Uso
OEC abre el directorio actual o el proyecto indicado como argumento. La raíz del proyecto limita el explorador, Git, búsquedas y archivos editables.

## Paneles y editor
F7 alterna el explorador; F8 alterna Cambios, igual que Files y Diff en el plugin. Si el terminal no tiene espacio para ambos paneles laterales, OEC muestra uno por vez. Ctrl+S guarda, Ctrl+W cierra y Ctrl+Q sale. El botón medio cierra desde cualquier parte de la pestaña, con confirmación si hay cambios sin guardar. Un asterisco indica cambios sin guardar.

Ctrl+A selecciona todo el archivo activo con foco en el editor, sin cambiar su contenido. También está disponible en la paleta como “Seleccionar todo el archivo”. No actúa detrás de búsquedas ni diálogos. Puede reasignarse mediante keyboard.bindings["editor.selectAll"].

## Búsqueda e ignorados
El explorador tiene un filtro permanente por nombre/ruta y muestra coincidencias en árbol. Ctrl+F alterna ese campo a búsqueda simple por contenido y de vuelta a nombre/ruta. Esc limpia el filtro y restaura el árbol normal sin ocultar el buscador. Ctrl+F desde el editor busca texto en el archivo. Ctrl+Alt+F conserva la búsqueda avanzada de texto en el proyecto. La raíz .gitignore se respeta de forma predeterminada y .git siempre está excluido. Ctrl+E modifica exclusiones solo durante la sesión; nunca se persisten.

## Git
En la vista local de Cambios, Enter alterna carpetas y abre diffs. + suma archivos o carpetas completas a STAGED; - quita cambios preparados o descarta cambios pendientes tras confirmar. Baja con la flecha hasta el mensaje de commit y pulsa Enter para confirmar. F6 ejecuta pull; “Git: enviar cambios (push)” en Ctrl+P ejecuta push. Las mutaciones Git (stage, unstage, descarte, commit, pull y push) están bloqueadas al navegar historial o ramas.

El pie de Cambios tiene botones para agregar, quitar del stage, descartar, pull, push, historial y ramas. Commit está a la derecha del mensaje y requiere mensaje y cambios preparados. Con foco en Git, Shift+F6 ejecuta push y Shift+F9 abre historial; F7/F8 siguen alternando paneles. Los controles cliqueables muestran manito si el terminal soporta OSC 22.

“Git: ver historial de commits” en Ctrl+P abre en el panel derecho el historial completo de la rama actual. Los commits se cargan por páginas al navegar, sin límite total. Con foco en Git, F9 lista las ramas locales y remotas conocidas; las remotas son referencias disponibles localmente, no una consulta en vivo al servidor.

Enter sobre una rama abre sus commits sin hacer checkout; sobre un commit abre sus archivos modificados; sobre un archivo abre un diff histórico de solo lectura en una pestaña, manteniendo el panel derecho. Con foco en Git, Esc vuelve de archivos a historial, luego a ramas si se llegó desde esa lista y finalmente a cambios locales. Las pestañas diff abiertas se conservan.

F5 en Git ejecuta fetch y vuelve a leer el estado local incluso si falla fetch; también refresca la vista histórica si corresponde, sin reemplazarla por cambios locales.

En un diff local, staged o histórico, F4 abre el archivo actual del proyecto sin cerrar el diff. No abre ni restaura la versión histórica. Si el archivo no existe, muestra un aviso y no lo recrea. Fuera de diffs, F4 alterna preview y edición de Markdown / SVG; el manual permanece de solo lectura.

Ctrl+P incluye los comandos adicionales “Git: ver historial de commits”, “Git: enviar cambios (push)”, “Git: ver todas las ramas” (F9) y, con un diff activo, “Abrir archivo del proyecto” (F4), además de la actualización de referencias remotas.

F10 abre la carpeta raíz en el explorador de archivos del sistema. Con foco en el explorador, F2 renombra el archivo o carpeta seleccionada y conserva las pestañas abiertas.

## Registro de errores
Cuando falla una operación, el pie indica F12. F12 abre una pestaña de solo lectura con los detalles técnicos del registro de esta sesión.

## Configuración
Abra “Abrir configuración” desde Ctrl+P para usar la pantalla TUI o pulse E para editar el JSON. Windows usa %APPDATA%\\openeditorcode\\config.json; Linux usa $XDG_CONFIG_HOME/openeditorcode/config.json o ~/.config/openeditorcode/config.json. El proyecto puede sobrescribir preferencias en .oec/config.json. El esquema completo está en docs/oec-config.schema.json.

Una configuración inválida o que impide iniciar OEC se copia a config.bkp.json (el mismo backup se sobrescribe en cada recuperación) y se restaura la configuración de fábrica. Las actualizaciones npm no modifican este directorio.

## Preview
SVG abre en preview; F4 alterna con el XML editable y conserva cambios sin guardar. El render es estático, sin scripts ni imágenes externas. Un SVG inválido permite volver al código con F4. Deshabilitar preview.images deja SVG en modo código.

Los archivos Markdown abren como preview de solo lectura. F4 alterna entre preview y edición; el manual nunca se puede editar. Los bloques fenced mermaid muestran diagramas Unicode de terminal para flowcharts, estados, secuencias, clases, ER y gráficos XY; los no compatibles permanecen como código. PNG, JPEG, WebP y GIF se muestran como imágenes de solo lectura y usan Kitty, Sixel o bloques de terminal según la capacidad configurada.

## Límites
Solo se editan archivos UTF-8 de hasta 2 MiB. Los binarios, enlaces que salen de la raíz y archivos demasiado grandes se rechazan. El manual completo distribuido está en docs/manual.md y en man oec.`,
  en: `# OpenEditorCode Manual

## Usage
OEC opens the current directory or the project supplied as an argument. The project root limits the explorer, Git, searches, and editable files.

## Panels and editor
F7 toggles the explorer; F8 toggles Changes, matching Files and Diff in the plugin. When the terminal does not have room for both side panels, OEC shows one at a time. Ctrl+S saves, Ctrl+W closes, and Ctrl+Q quits. Middle-click anywhere on a tab to close it, with confirmation for unsaved changes. An asterisk marks unsaved changes.

Ctrl+A selects the entire active file while the editor has focus, without changing its contents. It is also available in the palette as “Select all file contents”. It does not act behind searches or dialogs. Remap it through keyboard.bindings["editor.selectAll"].

## Search and ignored files
Explorer has a permanent name/path filter with tree results. Ctrl+F toggles that field to simple content search and back to name/path. Esc clears the filter and restores the normal tree without hiding the field. Ctrl+F from Editor searches text in the file. Ctrl+Alt+F keeps the advanced project text search. The root .gitignore is respected by default and .git is always excluded. Ctrl+E changes exclusions only for the current session; they are never persisted.

## Git
In the local Changes view, Enter toggles folders and opens diffs. + adds files or whole folders to STAGED; - removes staged changes or discards pending changes after confirmation. Move down to the commit message and press Enter to commit. F6 pulls; “Git: push changes” in Ctrl+P pushes. Git mutations (stage, unstage, discard, commit, pull, and push) are blocked while browsing history or branches.

The Changes footer also has clickable stage, unstage, discard, pull, push, history, and branches buttons. Commit sits to the right of the message and requires a message and staged changes. With Git focused, Shift+F6 pushes and Shift+F9 opens history. F7/F8 still toggle panels. Clickable controls show a hand pointer when the terminal supports OSC 22.

“Git: view commit history” in Ctrl+P opens the current branch's complete history in the right pane. Commits load in pages as you navigate, with no total limit. With Git focused, F9 lists known local and remote branches; remote branches are locally available references, not a live server query.

Enter on a branch opens its commits without checkout; on a commit it opens its changed files; on a file it opens a read-only historical diff in a tab while keeping the right pane open. With Git focused, Esc returns from files to history, then to branches if you came from that list, and finally to local changes. Open diff tabs are preserved.

F5 in Git fetches and rereads local status even if fetch fails; it also refreshes the historical view when applicable, without replacing it with local changes.

In a local, staged, or historical diff, F4 opens the current project file without closing the diff. It does not open or restore the historical version. If the file does not exist, a notice is shown and the file is not recreated. Outside diffs, F4 toggles Markdown / SVG preview and editing; the manual remains read-only.

Ctrl+P includes the additional commands “Git: view commit history”, “Git: push changes”, “Git: view all branches” (F9), and, with a diff active, “Open project file” (F4), alongside refreshing remote references.

F10 opens the project root in the system file manager. With Explorer focused, F2 renames the selected file or folder while preserving open tabs.

## Error log
When an operation fails, the footer points to F12. F12 opens a read-only tab with the technical details recorded during this session.

## Configuration
Open “Open settings” from Ctrl+P to use the TUI screen or press E to edit JSON. Windows uses %APPDATA%\\openeditorcode\\config.json; Linux uses $XDG_CONFIG_HOME/openeditorcode/config.json or ~/.config/openeditorcode/config.json. A project can override preferences in .oec/config.json. Set appearance.language to auto, es, or en. auto follows the operating system language and falls back to English. The complete schema is in docs/oec-config.schema.json.

An invalid configuration or one that prevents OEC from starting is copied to config.bkp.json (the same backup is overwritten on every recovery) and factory settings are restored. npm updates do not modify this directory.

## Preview
SVG opens in preview; F4 toggles editable XML while retaining unsaved changes. Rendering is static, without scripts or external images. Invalid SVG still allows returning to source with F4. Disabling preview.images keeps SVG in source mode.

Markdown files open in a read-only preview. F4 switches between preview and editing; the manual can never be edited. Fenced mermaid blocks render as Unicode terminal diagrams for flowcharts, state, sequence, class, ER, and XY charts; unsupported diagrams remain source code. PNG, JPEG, WebP, and GIF are read-only image previews that use Kitty, Sixel, or terminal blocks according to configured capability.

## Limits
Only UTF-8 files up to 2 MiB can be edited. Binaries, links outside the root, and oversized files are rejected. The full distributed manual is in docs/manual.md and man oec.`,
}

export function oecManual(language: SupportedLanguage): string { return manuals[language] }
