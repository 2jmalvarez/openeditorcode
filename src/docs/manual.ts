import type { SupportedLanguage } from "../localization"

const manuals: Record<SupportedLanguage, string> = {
  es: `# Manual de OpenEditorCode

## Uso
OEC abre el directorio actual o el proyecto indicado como argumento. La raíz del proyecto limita el explorador, Git, búsquedas y archivos editables.

## Paneles y editor
Ctrl+B alterna el explorador; Ctrl+Alt+B alterna Cambios. Si el terminal no tiene espacio para ambos paneles laterales, OEC muestra uno por vez. Ctrl+S guarda, Ctrl+W cierra y Ctrl+Q sale. Un asterisco indica cambios sin guardar.

## Búsqueda e ignorados
Ctrl+F busca archivos desde el explorador o texto desde el editor. Ctrl+Alt+F busca texto en el proyecto. La raíz .gitignore se respeta de forma predeterminada y .git siempre está excluido. Ctrl+E modifica exclusiones solo durante la sesión; nunca se persisten.

## Configuración
Abra “Editar configuración de OEC” desde Ctrl+P. Windows usa %APPDATA%\\openeditorcode\\config.json; Linux usa $XDG_CONFIG_HOME/openeditorcode/config.json o ~/.config/openeditorcode/config.json. El esquema completo está en docs/oec-config.schema.json.

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

## Configuration
Open “Edit OEC configuration” from Ctrl+P. Windows uses %APPDATA%\\openeditorcode\\config.json; Linux uses $XDG_CONFIG_HOME/openeditorcode/config.json or ~/.config/openeditorcode/config.json. Set appearance.language to auto, es, or en. auto follows the operating system language and falls back to English. The complete schema is in docs/oec-config.schema.json.

An invalid configuration or one that prevents OEC from starting is copied to config.bkp.json (the same backup is overwritten on every recovery) and factory settings are restored. npm updates do not modify this directory.

## Preview
Markdown files open in a read-only preview. F4 switches between preview and editing; the manual can never be edited. PNG, JPEG, WebP, and GIF are read-only image previews that use Kitty, Sixel, or terminal blocks according to configured capability.

## Limits
Only UTF-8 files up to 2 MiB can be edited. Binaries, links outside the root, and oversized files are rejected. The full distributed manual is in docs/manual.md and man oec.`,
}

export function oecManual(language: SupportedLanguage): string { return manuals[language] }
