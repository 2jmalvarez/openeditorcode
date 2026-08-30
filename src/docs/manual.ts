import type { SupportedLanguage } from "../localization"

const manuals: Record<SupportedLanguage, string> = {
  es: `# Manual de OpenEditorCode

## Uso
OEC abre el directorio actual o el proyecto indicado como argumento. La raíz del proyecto limita el explorador, Git, búsquedas y archivos editables.

## Paneles y editor
Ctrl+B alterna el explorador; Ctrl+Alt+B alterna Cambios. Si el terminal no tiene espacio para ambos paneles laterales, OEC muestra uno por vez. Ctrl+S guarda, Ctrl+W cierra y Ctrl+Q sale. Un asterisco indica cambios sin guardar.

## Búsqueda e ignorados
Ctrl+F busca archivos desde el explorador o texto desde el editor. Ctrl+Alt+F busca texto en el proyecto. La raíz .gitignore se respeta de forma predeterminada y .git siempre está excluido. Ctrl+E modifica exclusiones solo durante la sesión; nunca se persisten.

## Git
En Cambios, Enter alterna carpetas y abre diffs. + suma archivos o carpetas completas a STAGED; - quita cambios preparados o descarta cambios pendientes tras confirmar. Baja con la flecha hasta el mensaje de commit y pulsa Enter para confirmar. F6 ejecuta pull y F7 push.

## Registro de errores
Cuando falla una operación, el pie indica F12. F12 abre una pestaña de solo lectura con los detalles técnicos del registro de esta sesión.

## Configuración
Abra “Abrir configuración” desde Ctrl+P para usar la pantalla TUI o pulse E para editar el JSON. Windows usa %APPDATA%\\openeditorcode\\config.json; Linux usa $XDG_CONFIG_HOME/openeditorcode/config.json o ~/.config/openeditorcode/config.json. El proyecto puede sobrescribir preferencias en .oec/config.json. El esquema completo está en docs/oec-config.schema.json.

Una configuración inválida o que impide iniciar OEC se copia a config.bkp.json (el mismo backup se sobrescribe en cada recuperación) y se restaura la configuración de fábrica. Las actualizaciones npm no modifican este directorio.

## Preview
Los archivos Markdown abren como preview de solo lectura. F4 alterna entre preview y edición; el manual nunca se puede editar. PNG, JPEG, WebP y GIF se muestran como imágenes de solo lectura y usan Kitty, Sixel o bloques de terminal según la capacidad configurada.

## Límites
Solo se editan archivos UTF-8 de hasta 2 MiB. Los binarios, enlaces que salen de la raíz y archivos demasiado grandes se rechazan. El manual completo distribuido está en docs/manual.md y en man oec.`,
  en: `# OpenEditorCode Manual

## Usage
OEC opens the current directory or the project supplied as an argument. The project root limits the explorer, Git, searches, and editable files.

## Panels and editor
Ctrl+B toggles the explorer; Ctrl+Alt+B toggles Changes. When the terminal does not have room for both side panels, OEC shows one at a time. Ctrl+S saves, Ctrl+W closes, and Ctrl+Q quits. An asterisk marks unsaved changes.

## Search and ignored files
Ctrl+F searches files from the explorer or text from the editor. Ctrl+Alt+F searches text in the project. The root .gitignore is respected by default and .git is always excluded. Ctrl+E changes exclusions only for the current session; they are never persisted.

## Git
In Changes, Enter toggles folders and opens diffs. + adds files or whole folders to STAGED; - removes staged changes or discards pending changes after confirmation. Move down to the commit message and press Enter to commit. F6 pulls and F7 pushes.

## Error log
When an operation fails, the footer points to F12. F12 opens a read-only tab with the technical details recorded during this session.

## Configuration
Open “Open configuration” from Ctrl+P to use the TUI screen or press E to edit JSON. Windows uses %APPDATA%\\openeditorcode\\config.json; Linux uses $XDG_CONFIG_HOME/openeditorcode/config.json or ~/.config/openeditorcode/config.json. A project can override preferences in .oec/config.json. Set appearance.language to auto, es, or en. auto follows the operating system language and falls back to English. The complete schema is in docs/oec-config.schema.json.

An invalid configuration or one that prevents OEC from starting is copied to config.bkp.json (the same backup is overwritten on every recovery) and factory settings are restored. npm updates do not modify this directory.

## Preview
Markdown files open in a read-only preview. F4 switches between preview and editing; the manual can never be edited. PNG, JPEG, WebP, and GIF are read-only image previews that use Kitty, Sixel, or terminal blocks according to configured capability.

## Limits
Only UTF-8 files up to 2 MiB can be edited. Binaries, links outside the root, and oversized files are rejected. The full distributed manual is in docs/manual.md and man oec.`,
}

export function oecManual(language: SupportedLanguage): string { return manuals[language] }
