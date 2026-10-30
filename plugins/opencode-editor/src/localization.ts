import { resolveLanguage, translateKnown, t as sharedText, type LanguagePreference } from "../../../src/localization"
import { useRevision } from "./workbench/reactive"

/** English source templates are stable keys; interpolated paths and file contents are never translated. */
export const spanish = {
  "OEC shortcuts": "Atajos de OEC",
  "conversation/editor, preserve panel visibility": "conversación/editor, conservar visibilidad de paneles",
  "show/hide the entire Files section, including its header": "mostrar/ocultar toda la sección Archivos, incluido su encabezado",
  "show/hide Diff (visible by default)": "mostrar/ocultar Cambios (visible por defecto)",
  "diff → current editable file; Markdown / SVG preview ↔ edit": "cambios → archivo editable actual; vista previa Markdown / SVG ↔ edición",
  "F2 in Files": "F2 en Archivos", "rename selected file/folder": "renombrar archivo/carpeta seleccionado",
  "Ctrl+E in name search": "Ctrl+E en búsqueda por nombre", "fuzzy/literal; Ctrl+F in search: name/path ↔ content": "difusa/literal; Ctrl+F en búsqueda: nombre/ruta ↔ contenido",
  "save · Ctrl+W: close · Shift+Tab: next document": "guardar · Ctrl+W: cerrar · Shift+Tab: siguiente documento",
  "Middle-click anywhere on a tab": "Clic central en cualquier parte de una pestaña", "close (confirm unsaved changes)": "cerrar (confirmar cambios sin guardar)",
  "focus Files/Diff/editor · / in Files: focus search": "enfocar Archivos/Cambios/editor · / en Archivos: enfocar búsqueda",
  "find in editable file · Ctrl+L: line wrap": "buscar en archivo editable · Ctrl+L: ajustar líneas",
  "select all · Ctrl+C/V: clipboard": "seleccionar todo · Ctrl+C/V: portapapeles", "undo/redo": "deshacer/rehacer", "insert line below/above": "insertar línea debajo/encima",
  "duplicate line · Alt+↑/↓: move line": "duplicar línea · Alt+↑/↓: mover línea", "delete line · Ctrl+D: select word": "eliminar línea · Ctrl+D: seleccionar palabra",
  "file start/end · Ctrl+←/→: word": "inicio/fin del archivo · Ctrl+←/→: palabra", "line start/end · Shift+Home/End: select to line start/end": "inicio/fin de línea · Shift+Home/End: seleccionar hasta inicio/fin de línea",
  "Shift + navigation": "Shift + navegación", "extend selection · PageUp/Down: page": "extender selección · PageUp/Down: página",
  "navigate/open Files or Diff": "navegar/abrir Archivos o Cambios", "Enter/Space on accordion": "Enter/Espacio en el encabezado", "expand/collapse": "expandir/colapsar",
  "Files accordion expansion is independent from F7 visibility and is preserved when hidden": "La expansión de Archivos es independiente de su visibilidad con F7 y se conserva al ocultarlo",
  "Left/Right on Files or Diff": "Izquierda/Derecha en Archivos o Cambios", "collapse/expand; Left from a leaf: parent folder": "colapsar/expandir; Izquierda desde un archivo: carpeta superior",
  "Home/End in Files/Diff tree": "Home/End en el árbol Archivos/Cambios", "first/last row; PageUp/Down: previous/next page": "primera/última fila; PageUp/Down: página anterior/siguiente",
  "Wheel/scrollbar": "Rueda/barra de desplazamiento", "manual scrolling; refresh keeps its position; navigation reveals selection": "desplazamiento manual; actualizar conserva la posición; navegar muestra la selección",
  "refresh focused Files/Diff/editor": "actualizar Archivos/Cambios/editor enfocado", "clear search, then return focus": "limpiar búsqueda y devolver el foco", "Read-only views": "Vistas de solo lectura", "arrows, Home/End, PageUp/Down": "flechas, Home/End, PageUp/Down",
  "Images": "Imágenes", "PNG, JPEG, GIF, WebP; no editing": "PNG, JPEG, GIF, WebP; sin edición", "static local preview, F4 edits XML, previews unsaved changes; invalid SVG stays editable.": "vista previa local estática, F4 edita XML, muestra cambios sin guardar; un SVG inválido sigue siendo editable.",
  "Content search": "Búsqueda de contenido", "literal, case-insensitive, disk files, first 80 matches; ignores binaries and files above 2 MiB.": "literal, sin distinguir mayúsculas, archivos en disco, primeras 80 coincidencias; ignora binarios y archivos mayores de 2 MiB.",
  "● staged vs HEAD; ○ working tree vs index; ? untracked": "● preparados frente a HEAD; ○ árbol de trabajo frente al índice; ? sin seguimiento",
  "Diff colors": "Colores de Cambios", "+ green, − red; ● blue staged; ○ green new, red deleted, warning modified/renamed.": "+ verde, − rojo; ● azul preparados; ○ verde nuevos, rojo eliminados, advertencia modificados/renombrados.",
  "Git reads disk/index, not unsaved editor buffers.": "Git lee disco/índice, no los cambios sin guardar del editor.", "Additional textarea shortcuts (editable source only)": "Atajos adicionales del editor (solo código editable)",
  "Set plugin options in global cli.json → plugins[].options (not opencode.json).": "Configurá las opciones del plugin en cli.json global → plugins[].options (no en opencode.json).", "Current defaults:": "Valores actuales:",
  "optional absolute local directory override; otherwise confirm active session directory.": "directorio local absoluto opcional; de lo contrario, confirmar el directorio de la sesión activa.",
  "Local access": "Acceso local", "allow for this TUI only, or remember this exact folder on this computer across restarts.": "permitir solo en esta TUI o recordar esta carpeta exacta en esta computadora tras reiniciar.",
  "Palette": "Paleta", '"Forget remembered folder access" removes saved permission; current documents remain open until the TUI exits.': '"Olvidar acceso recordado a carpetas" elimina el permiso guardado; los documentos actuales siguen abiertos hasta salir de la TUI.',
  "conversation/editor (default f6)": "conversación/editor (f6 por defecto)", "Files (default f7)": "Archivos (f7 por defecto)", "Diff (default f8), independent of filesBinding": "Cambios (f8 por defecto), independiente de filesBinding", "auto (system) | es | en": "auto (sistema) | es | en", "18–60 columns": "18–60 columnas",
  "expanded (default, share remaining height) | compact (bounded panels)": "expanded (por defecto, compartir altura disponible) | compact (paneles acotados)", "fuzzy (whole path, ordered letters) | literal (name contains text; paths if query contains /)": "fuzzy (ruta completa, letras en orden) | literal (el nombre contiene el texto; rutas si la consulta contiene /)",
  "true | false (default view for newly opened Markdown)": "true | false (vista por defecto al abrir Markdown)", "split | unified": "split (dividida) | unified (unificada)", "auto | blocks (portable colored-cell fallback)": "auto | blocks (alternativa portátil con celdas de color)", "{ enabled: boolean, exclude: non-negated gitignore patterns }": "{ enabled: boolean, exclude: patrones gitignore sin negación }",
  "Menu changes affect this project's current controller only. Edit cli.json for defaults after restart.": "Los cambios del menú afectan solo al proyecto actual. Editá cli.json para conservar los valores tras reiniciar.", "No personal configuration is written automatically.": "No se escribe configuración personal automáticamente.",
  "Files": "Archivos", "Diff": "Cambios", "Collapse": "Colapsar", "No wrap": "Sin ajuste", "No break": "Sin salto", "Wrap": "Ajustar",
  "Local access: allow for this TUI only, or remember this exact folder on this computer across restarts.": "Acceso local: permitir solo en esta TUI o recordar esta carpeta exacta en esta computadora tras reiniciar.",
  "Conversation": "Conversación", "Local files": "Archivos locales", "Select a file on the right": "Seleccioná un archivo a la derecha",
  "editor": "editor", "explorer": "archivos", "search": "búsqueda", "panels": "paneles",
  "Search content…": "Buscar contenido…", "Search files…": "Buscar archivos…", "Name ^F": "Nombre ^F", "Fuzzy ^F": "Difusa ^F", "Literal ^F": "Literal ^F",
  "Searching…": "Buscando…", "No matching files": "No se encontraron archivos", "{count} results": "{count} resultados", "first 80": "primeros 80", "index limited": "índice limitado",
  "Enter: diff tab": "Enter: pestaña de cambios", "F5 to retry": "F5 para reintentar", "Changes may be outdated": "Los cambios pueden estar desactualizados",
  "Loading changes…": "Cargando cambios…", "No repository": "Sin repositorio", "No changes": "Sin cambios", "Branch unavailable": "Rama no disponible", "Git refresh timed out": "Se agotó el tiempo de actualización de Git",
  "Repository discovery failed": "Falló la búsqueda de repositorios",
  "Searching repositories…": "Buscando repositorios…",
  "staged:": "preparados:", "Line wrap on": "Ajuste de líneas activado", "Line wrap off": "Ajuste de líneas desactivado",
  "Saved": "Guardado", "Reloaded from disk": "Recargado desde el disco", "Opened {path}": "Abierto {path}", "Renamed to {name}": "Renombrado a {name}",
  "Recovered {count} file(s). Review and save explicitly.": "Se recuperaron {count} archivo(s). Revisá y guardá explícitamente.",
  "Stored drafts deleted. Open documents were not changed.": "Borradores almacenados eliminados. Los documentos abiertos no se modificaron.",
  "File changed during confirmation; close cancelled.": "El archivo cambió durante la confirmación; se canceló el cierre.",
  "Git diff · disk/index, not unsaved edits · F4 edit current file": "Cambios Git · disco/índice, no ediciones sin guardar · F4 editar archivo actual",
  "File changed or deleted on disk. Local edits retained. Use OEC: reload file from disk.": "El archivo cambió o se eliminó del disco. Se conservaron las ediciones locales. Usá OEC: recargar archivo desde el disco.",
  "Ctrl+S save / Ctrl+F find / Ctrl+L wrap / Tab focus": "Ctrl+S guardar / Ctrl+F buscar / Ctrl+L ajustar / Tab foco",
  "Git diff · F4 edit current file · read-only": "Cambios Git · F4 editar archivo actual · solo lectura",
  "SVG preview · F4 edit XML": "Vista previa SVG · F4 editar XML", "Image · read-only · OEC settings: image protocol": "Imagen · solo lectura · Configuración OEC: protocolo de imagen",
  "OEC · reference · read-only": "OEC · referencia · solo lectura", "Markdown preview · F4 edit": "Vista previa Markdown · F4 editar",
  "No textual changes (empty file or change already resolved).": "Sin cambios de texto (archivo vacío o cambio ya resuelto).",
  "Rendering SVG…": "Renderizando SVG…", "Cannot display SVG. F4 to edit XML.": "No se puede mostrar el SVG. F4 para editar XML.",
  "Cannot display image: {error}. Supported: PNG, JPEG, GIF, WebP.": "No se puede mostrar la imagen: {error}. Formatos admitidos: PNG, JPEG, GIF, WebP.",
  "Recover unsaved files": "Recuperar archivos sin guardar", "{count} unsaved file(s) · {id}": "{count} archivo(s) sin guardar · {id}",
  "Delete stored drafts?": "¿Eliminar los borradores almacenados?",
  "Delete recovery copies for this project, including other terminal generations? Open documents and project files are not changed. Unsaved open documents may generate new drafts.": "¿Eliminar las copias de recuperación de este proyecto, incluidas las de otras instancias de terminal? Los documentos abiertos y los archivos del proyecto no se modifican. Los documentos abiertos sin guardar pueden generar nuevos borradores.",
  "Rename {name}": "Renombrar {name}", "Unsaved changes": "Cambios sin guardar", "Cancel": "Cancelar", "Save and close": "Guardar y cerrar", "Close without saving": "Cerrar sin guardar",
  "Reload from disk?": "¿Recargar desde el disco?", "Discard local edits? A deleted file will not be recreated.": "¿Descartar las ediciones locales? No se recreará un archivo eliminado.",
  "Local access: {path}": "Acceso local: {path}", "Allow for this TUI only": "Permitir solo en esta TUI", "Allow and remember this folder": "Permitir y recordar esta carpeta", "Deny access": "Denegar acceso",
  "Access on THIS computer only. OEC does not read the remote server's filesystem.": "Acceso solo en ESTA computadora. OEC no lee el sistema de archivos del servidor remoto.",
  "Remember on this computer across restarts. Other folders still require permission.": "Recordar en esta computadora tras reiniciar. Las demás carpetas siguen requiriendo permiso.", "Do not open local project files.": "No abrir archivos locales del proyecto.",
  "Remembered local access": "Acceso local recordado", "Forget remembered local access": "Olvidar acceso local recordado", "Forget this folder?": "¿Olvidar esta carpeta?",
  "No folders have remembered access on this computer. An explicit localRoot override is controlled in cli.json.": "No hay carpetas con acceso recordado en esta computadora. Un localRoot explícito se controla en cli.json.",
  "Forget remembered access to {path}? Open documents stay available in this TUI. After restarting, OEC will ask again. An explicit localRoot override in cli.json still grants access.": "¿Olvidar el acceso recordado a {path}? Los documentos abiertos siguen disponibles en esta TUI. Tras reiniciar, OEC volverá a preguntar. Un localRoot explícito en cli.json sigue otorgando acceso.",
  "Remembered access removed. OEC will ask again after restarting.": "Acceso recordado eliminado. OEC volverá a preguntar tras reiniciar.",
  "Configuration": "Configuración", "Plugin options": "Opciones del plugin", "Shortcuts": "Atajos", "All keyboard shortcuts": "Todos los atajos de teclado", "View all options and current values": "Ver todas las opciones y los valores actuales",
  "Search: fuzzy": "Búsqueda: difusa", "Search: literal": "Búsqueda: literal", "Markdown default: preview": "Markdown por defecto: vista previa", "Markdown default: source": "Markdown por defecto: código",
  "Diff: split": "Cambios: divididos", "Diff: unified": "Cambios: unificados", "Diff layout: split": "Vista de cambios: dividida", "Diff layout: unified": "Vista de cambios: unificada",
  "Panel height: expanded": "Altura de paneles: expandida", "Panel height: compact": "Altura de paneles: compacta", "Image protocol: auto": "Protocolo de imagen: automático", "Image protocol: blocks": "Protocolo de imagen: bloques", "Images: auto": "Imágenes: automático", "Images: blocks": "Imágenes: bloques",
  "Language: auto": "Idioma: automático", "Language: en": "Idioma: inglés", "Language: es": "Idioma: español", "Automatic (system)": "Automático (sistema)", "English": "Inglés", "Spanish": "Español", "Language": "Idioma",
  "toggle conversation/editor": "alternar conversación/editor", "Show/hide Files": "Mostrar/ocultar Archivos", "show/hide Diff": "mostrar/ocultar Cambios",
  "delete stored drafts for this project": "eliminar borradores almacenados de este proyecto", "forget remembered folder access": "olvidar acceso recordado a carpetas", "plugin configuration": "configuración del plugin",
  "toggle fuzzy/literal file search": "alternar búsqueda de archivos difusa/literal", "toggle file name/content search": "alternar búsqueda por nombre/contenido", "toggle expanded/compact panel height": "alternar altura de paneles expandida/compacta",
  "expand/collapse Files": "expandir/colapsar Archivos", "expand/collapse Diff": "expandir/colapsar Cambios", "refresh Files and Diff": "actualizar Archivos y Cambios", "clear file search": "limpiar búsqueda de archivos",
  "toggle split/unified diff": "alternar cambios divididos/unificados", "toggle default Markdown preview": "alternar vista previa Markdown por defecto", "toggle image auto/blocks protocol": "alternar protocolo de imagen automático/bloques",
  "open selected file search result": "abrir resultado seleccionado de búsqueda de archivos", "save file": "guardar archivo", "close file": "cerrar archivo", "reload file from disk": "recargar archivo desde el disco", "find in file": "buscar en archivo", "toggle line wrap": "alternar ajuste de líneas", "next file": "siguiente archivo", "switch editor/files focus": "alternar foco editor/archivos", "select all file contents": "seleccionar todo el contenido del archivo",
  "Edit changed file": "Editar archivo modificado", "Edit Markdown / SVG or toggle preview": "Editar Markdown / SVG o alternar vista previa", "Toggle file name/content search": "Alternar búsqueda por nombre/contenido",
  "Previous row": "Fila anterior", "Next row": "Fila siguiente", "Open selection / toggle folder": "Abrir selección / alternar carpeta", "Expand / open selection": "Expandir / abrir selección", "Collapse / parent folder": "Colapsar / carpeta superior",
  "Refresh": "Actualizar", "Clear search / leave panel": "Limpiar búsqueda / salir del panel", "Return focus": "Devolver foco", "Focus Files": "Enfocar Archivos", "Next panel": "Siguiente panel", "Focus file search": "Enfocar búsqueda de archivos", "Toggle fuzzy/literal name search": "Alternar búsqueda por nombre difusa/literal", "Toggle name/content search": "Alternar búsqueda por nombre/contenido",
  "Collapse all Diff repositories and folders": "Colapsar todos los repositorios y carpetas de Cambios", "Toggle Diff repository and branch name wrapping": "Alternar ajuste de nombres de repositorios y ramas de Cambios",
  "Previous Diff page": "Página anterior de Cambios", "Next Diff page": "Página siguiente de Cambios", "First changed file or folder": "Primer archivo o carpeta modificado", "Last changed file or folder": "Último archivo o carpeta modificado",
  "Previous Files page": "Página anterior de Archivos", "Next Files page": "Página siguiente de Archivos", "First file or folder": "Primer archivo o carpeta", "Last file or folder": "Último archivo o carpeta", "Rename selected file/folder": "Renombrar archivo/carpeta seleccionado",
  "Save file": "Guardar archivo", "Close tab": "Cerrar pestaña", "Reload file from disk": "Recargar archivo desde el disco", "Next document": "Siguiente documento", "Find in file": "Buscar en archivo", "Toggle line wrap": "Alternar ajuste de líneas", "Focus editor / Files / Diff": "Enfocar editor / Archivos / Cambios",
  "insert newline": "insertar salto de línea", "insert newline (Shift)": "insertar salto de línea (Shift)", "insert line below": "insertar línea debajo", "insert line above": "insertar línea encima", "duplicate line above": "duplicar línea encima", "duplicate line below": "duplicar línea debajo", "move line up": "mover línea arriba", "move line down": "mover línea abajo", "delete line": "eliminar línea", "select word": "seleccionar palabra", "undo": "deshacer", "redo": "rehacer", "copy selection": "copiar selección", "paste clipboard": "pegar portapapeles", "refresh editor and local Git": "actualizar editor y Git local",
  "Move cursor left": "Mover cursor a la izquierda", "Move cursor right": "Mover cursor a la derecha", "Move cursor up": "Mover cursor arriba", "Move cursor down": "Mover cursor abajo", "Select left": "Seleccionar a la izquierda", "Select right": "Seleccionar a la derecha", "Select up": "Seleccionar arriba", "Select down": "Seleccionar abajo",
  "File start": "Inicio del archivo", "File end": "Fin del archivo", "Select to file start": "Seleccionar hasta el inicio del archivo", "Select to file end": "Seleccionar hasta el fin del archivo", "Line start": "Inicio de línea", "Line end": "Fin de línea", "Select to line start": "Seleccionar hasta el inicio de línea", "Select to line end": "Seleccionar hasta el fin de línea",
  "Visual line start": "Inicio de línea visual", "Visual line end": "Fin de línea visual", "Select to visual line start": "Seleccionar hasta el inicio de línea visual", "Select to visual line end": "Seleccionar hasta el fin de línea visual", "Next word": "Palabra siguiente", "Previous word": "Palabra anterior", "Select next word": "Seleccionar palabra siguiente", "Select previous word": "Seleccionar palabra anterior",
  "Delete next word": "Eliminar palabra siguiente", "Delete previous word": "Eliminar palabra anterior", "Delete line": "Eliminar línea", "Delete to line end": "Eliminar hasta el fin de línea", "Delete to line start": "Eliminar hasta el inicio de línea", "Delete previous character": "Eliminar carácter anterior", "Delete next character": "Eliminar carácter siguiente", "Insert newline": "Insertar salto de línea", "Undo": "Deshacer", "Redo": "Rehacer", "Select all file contents": "Seleccionar todo el contenido del archivo",
  "Previous page": "Página anterior", "Next page": "Página siguiente", "Select previous page": "Seleccionar página anterior", "Select next page": "Seleccionar página siguiente",
  "Git output exceeds the 2 MiB viewer limit": "La salida de Git supera el límite de 2 MiB del visor", "Invalid Git file path": "Ruta de archivo Git inválida", "Could not inspect local Git repository": "No se pudo inspeccionar el repositorio Git local", "Local Git status failed": "Falló el estado de Git local", "Repository discovery exceeds the 20,000 directory limit": "La búsqueda de repositorios supera el límite de 20.000 directorios", "Could not read Git branch": "No se pudo leer la rama Git", "Could not read local diff": "No se pudieron leer los cambios locales",
  "Maximum {count} open files": "Máximo de {count} archivos abiertos", "A file operation is in progress; try renaming again": "Hay una operación de archivos en curso; intentá renombrar de nuevo", "Draft limit (16 MiB) exceeded. Save files to protect your work.": "Se superó el límite de borradores (16 MiB). Guardá los archivos para proteger tu trabajo.",
  "Diff belongs to another project": "Los cambios pertenecen a otro proyecto", "OEC: invalid {option}": "OEC: opción inválida: {option}",
  "OEC: no absolute project directory is available. localRoot, when provided, must be an absolute local directory. Remote filesystem access is not supported.": "OEC: no hay un directorio absoluto de proyecto disponible. localRoot, si se indica, debe ser un directorio local absoluto. No se admite acceso al sistema de archivos remoto.",
  "OEC: explorerWidth must be between 18 and 60": "OEC: explorerWidth debe estar entre 18 y 60", "OEC: session location is not available yet": "OEC: la ubicación de la sesión todavía no está disponible", "OEC: remote workspaces require an explicit localRoot mapping; remote filesystem access is not supported": "OEC: los espacios de trabajo remotos requieren un localRoot explícito; no se admite acceso al sistema de archivos remoto", "OEC: this session is not in the selected project (localRoot)": "OEC: esta sesión no pertenece al proyecto seleccionado (localRoot)", "OEC: this session is not in the configured localRoot": "OEC: esta sesión no está en el localRoot configurado", "OEC: open a session in localRoot first": "OEC: abrí primero una sesión en localRoot",
  "OEC: invalid drafts options": "OEC: opciones drafts inválidas", "OEC: invalid drafts options (exclude must contain non-negated gitignore patterns)": "OEC: opciones drafts inválidas (exclude debe contener patrones gitignore sin negación)",
} as const

const patterns = Object.entries(spanish).filter(([key]) => key.includes("{")).map(([key, value]) => ({
  names: [...key.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!),
  expression: new RegExp(`^${key.split(/\{\w+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([\\s\\S]*?)")}$`), value,
}))

export function createTranslator(preference: LanguagePreference = "auto", systemLocale?: string) {
  const locale = resolveLanguage(preference, systemLocale)
  const translate = (source: string, values: Record<string, string | number> = {}): string => {
    const interpolate = (text: string) => text.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match)
    if (locale === "en") return translateKnown(interpolate(source), locale)
    const direct = Object.hasOwn(spanish, source) ? spanish[source as keyof typeof spanish] : undefined
    if (direct) return interpolate(direct)
    const trimmed = source.trim()
    if (trimmed !== source) return source.slice(0, source.indexOf(trimmed)) + translate(trimmed, values) + source.slice(source.indexOf(trimmed) + trimmed.length)
    if (source.includes("\n")) return source.split("\n").map((line) => translate(line, values)).join("\n")
    for (const pattern of patterns) {
      const match = pattern.expression.exec(source)
      if (match) return pattern.value.replace(/\{(\w+)\}/g, (_, name: string) => match[pattern.names.indexOf(name) + 1] ?? "")
    }
    const prefix = /^(OEC[:·] |OEC · |[▾▸←] )(.+)$/.exec(source)
    if (prefix) return prefix[1] + translate(prefix[2]!, values)
    const separator = source.indexOf(": ")
    if (separator >= 0) return translate(source.slice(0, separator), values) + ": " + translate(source.slice(separator + 2), values)
    if (source.endsWith(":")) return translate(source.slice(0, -1), values) + ":"
    if (source.includes(" · ")) return source.split(" · ").map((part) => translate(part, values)).join(" · ")
    return translateKnown(interpolate(source), locale)
  }
  return Object.assign(translate, { locale, shared: (key: Parameters<typeof sharedText>[0], values = {}) => sharedText(key, values, locale) })
}

export type Translator = ReturnType<typeof createTranslator>

export function useTranslation(owner: { t: Translator; subscribe: (listener: () => void) => () => void }) {
  const revision = useRevision(owner)
  const text: Translator = Object.assign((...args: Parameters<Translator>) => { revision(); return owner.t(...args) }, {
    locale: owner.t.locale,
    shared: (...args: Parameters<Translator["shared"]>) => { revision(); return owner.t.shared(...args) },
  })
  return Object.defineProperty(text, "locale", { get: () => { revision(); return owner.t.locale } })
}
