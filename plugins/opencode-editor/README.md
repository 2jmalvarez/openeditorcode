# OEC para OpenCode 2 · editor local

Plugin opcional dentro de este repositorio. No modifica OpenCode y no sustituye el ejecutable autónomo de OEC.

Paquete público independiente: [`@2jmalvarez/opencode-editor@0.1.2`](https://www.npmjs.com/package/@2jmalvarez/opencode-editor/v/0.1.2). [Publicación por GitHub Actions/OIDC verificada](https://github.com/2jmalvarez/openeditorcode/actions/runs/39198286708), con integridad/provenance e instalación por nombre en Linux y Windows; carpeta automática confirmada en OpenCode 2.0.26/2.0.27. `0.1.0` tuvo un conflicto de peers.
`npm install -g openeditorcode` instala solamente OEC autónomo, no este plugin.

## Funciones

- Explorador de archivos en el panel derecho de la conversación, junto a las contribuciones existentes.
- Editor en una ruta propia, con explorador derecho y pestañas de archivos independientes de las pestañas de sesiones.
- Alternancia entre editor y conversación sin enviar prompts ni interrumpir al agente.
- Navegación con teclado y ratón; árbol virtualizado que mantiene visible la selección.
- Edición UTF-8, resaltado por línea, guardar, copiar/pegar, deshacer/rehacer y búsqueda literal local.
- Documentos, cursor y scroll conservados al alternar vistas y archivos.
- `Ctrl+A` selecciona todo el contenido del archivo activo; también está en la paleta como **OEC: select all file contents** en la copia local actual. Solo actúa con foco en el editor, sin búsqueda ni modal; no captura `Ctrl+A` del chat.
- Confirmación al cerrar documentos modificados; detección de modificaciones externas y archivos eliminados.
- Recuperación de borradores después de reiniciar o recargar el plugin, siempre con selección explícita.

## Construcción opcional desde código

No es necesaria para instalar el paquete público desde OpenCode. Solo para la alternativa de carga por carpeta local.

Desde la raíz de `openeditorcode`:

```powershell
bun install --frozen-lockfile
bun run plugin:build
```

El resultado es `plugins/opencode-editor/dist/tui.js`. Incluye los módulos OEC compartidos y sus dependencias de búsqueda de archivos; OpenTUI, Solid y la API de plugins se resuelven en el anfitrión.

Probado con OpenCode **2.0.26 y 2.0.27**. Runtime Bun **1.3.14+**; compatibilidad de anfitrión declarada en `engines.opencode` (`>=2.0.26 <3`, metadata informativa, no certificación de todas las versiones posteriores). OpenTUI `>=0.5.17 <0.6.0` y Solid `>=1.9.0 <2.0.0` son peers opcionales para el instalador porque OpenCode provee las instancias en runtime; no son opcionales para ejecutar el plugin. La API `@opencode/plugin` se declara solo como dependencia de desarrollo en la raíz de OEC: agregarla como peer del paquete publicado hace que Arborist atraviese sus peers opcionales y puede producir conflictos con versiones nuevas de OpenTUI. El loader provee esa API y el build la mantiene externa. No instalar copias privadas de OpenTUI/Solid. El OEC autónomo conserva sus dependencias actuales.

## Cargar el plugin

### Carpeta automática desde 0.1.2

El plugin toma automáticamente la carpeta de la sesión activa de OpenCode; desde inicio usa `context.location` o la ubicación predeterminada del anfitrión. No usa la carpeta de instalación del plugin ni el directorio del servicio. Al cambiar de proyecto conserva documentos y borradores separados por raíz; volver al mismo proyecto recupera sus pestañas.

Añadir esta entrada al array `plugins` del **`cli.json` global** de OpenCode, preservando sus demás valores. No existe `cli.json` de proyecto. No se necesita clonar OEC ni compilar:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [{
    "package": "@2jmalvarez/opencode-editor@0.1.2",
    "options": { "toggleBinding": "f6", "filesBinding": "f7", "explorerWidth": 30 }
  }]
}
```

Al abrir los archivos por primera vez, confirmar acceso a la carpeta **en esta computadora**, una vez por carpeta hasta salir de la TUI. La ubicación del servidor no prueba que exista un filesystem compartido: cancelar no lee archivos ni crea un workspace. Workspaces remotos requieren una `localRoot` explícita; no se implementa lectura remota. Una ubicación ausente o relativa produce un aviso, sin recurrir silenciosamente a otra carpeta. `localRoot` sigue disponible como override absoluto, conservando el comportamiento anterior.

`localRoot` ya no es obligatoria desde 0.1.2. Si una configuración anterior conserva esa opción, quitarla para seguir automáticamente cada proyecto. Opcionalmente fijar `"localRoot": "C:/ruta/mi-proyecto"` (Linux: `/home/usuario/mi-proyecto`) para mantener el opt-in explícito de una sola raíz; solo integra sesiones cuya ubicación coincide con ella. No utilizarlo para editar proyectos remotos aunque sus rutas textuales coincidan con carpetas locales.

Para la alternativa local, compilar y reemplazar únicamente `package` por la ruta absoluta de `plugins/opencode-editor` dentro del checkout. No cargar simultáneamente las entradas npm y local del mismo plugin. Las versiones anteriores a 0.1.2 sí requieren `localRoot`.

Volver a cargar el plugin o reiniciar la TUI tras cambiar la configuración. El build debe existir antes de cargar la alternativa por carpeta local.

## Uso

1. Abrir una sesión en el proyecto deseado. Desde 0.1.2 se detecta automáticamente; confirmar acceso al disco local cuando se solicite.
2. `F7` (con la configuración del ejemplo) o **OEC: show/hide session files** muestra el explorador en la conversación.
3. Flechas navegan el árbol; `Enter` expande una carpeta o abre un archivo en el editor. Un clic también lo abre.
4. `F6` (con la configuración del ejemplo) o **OEC: toggle conversation/editor** alterna entre ambas vistas.
5. `Ctrl+S` guarda; `Ctrl+W` cierra el archivo activo, con confirmación si está modificado.

Si OpenCode oculta su sidebar por falta de ancho, usar el comando de paleta **OEC: toggle conversation/editor**: el editor tiene su propio explorador. El plugin no fuerza el tamaño o la visibilidad del sidebar del anfitrión.

| Acción | Atajo en el editor |
| --- | --- |
| Cambiar foco editor/explorador | `Tab` |
| Nueva línea | `Enter` |
| Insertar línea debajo / encima | `Ctrl+Enter` / `Ctrl+Shift+Enter` |
| Duplicar línea arriba / abajo | `Shift+Alt+↑` / `Shift+Alt+↓` |
| Mover línea arriba / abajo | `Alt+↑` / `Alt+↓` |
| Eliminar línea | `Ctrl+Shift+K` |
| Seleccionar palabra / todo | `Ctrl+D` / `Ctrl+A` |
| Inicio / final del archivo | `Ctrl+Home` / `Ctrl+End` |
| Moverse por palabras | `Ctrl+←` / `Ctrl+→` |
| Seleccionar por palabras | `Ctrl+Shift+←` / `Ctrl+Shift+→` |
| Avanzar por páginas | `RePág` / `AvPág` |
| Seleccionar por páginas | `Shift+RePág` / `Shift+AvPág` |
| Siguiente archivo | `Shift+Tab` |
| Guardar / cerrar archivo | `Ctrl+S` / `Ctrl+W` |
| Búsqueda literal local | `Ctrl+F` |
| Elegir coincidencia | `↑` / `↓`, después `Enter` |
| Cerrar búsqueda / volver al editor desde el árbol | `Esc` |
| Copiar / pegar | `Ctrl+C` / `Ctrl+V` |
| Deshacer / rehacer | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Actualizar árbol y comprobar cambios en el archivo | `F5` |

Los comandos se registran en la paleta de OpenCode. `Ctrl+P` sigue perteneciendo al anfitrión. Los atajos del editor solo están activos en su vista; el árbol de la conversación solo captura teclas cuando tiene foco. `Esc` en el árbol de la conversación devuelve el control a OpenCode.

Dentro del editor, `Ctrl+Shift+←/→` selecciona por palabras; para cambiar de panel se usa `Tab`. `Ctrl+D` selecciona la palabra actual, sin multicursor. Duplicar/mover opera sobre la línea del cursor y se puede deshacer con `Ctrl+Z`. `Ctrl+C` copia solo la selección; `Ctrl+V` reemplaza la selección y conserva los saltos de línea del portapapeles. Si cambia el documento o cursor mientras se lee el portapapeles, la operación se cancela para no pegar en otro lugar.

Se recomiendan **F6** (conversación/editor) y **F7** (archivos), configurados explícitamente. Los defaults del código siguen siendo `Ctrl+Alt+O/J`; este procedimiento de publicación no los cambia.

## Cambios externos y recuperación

- Los archivos limpios se recargan al detectar cambios; los documentos con ediciones locales conservan sus contenidos y muestran un aviso.
- El archivo activo se comprueba al abrir el editor y cada tres segundos mientras la vista está montada.
- El guardado compara contra la última versión conocida en disco. No hay una opción de sobrescritura silenciosa.
- **OEC: reload file from disk** permite recargar tras confirmar el descarte de ediciones locales.
- Los archivos eliminados no se recrean automáticamente al guardar.
- Los borradores guardan contenido y versión base en el storage durable del anfitrión, **fuera del proyecto**. Pueden contener código sensible: no son un almacén cifrado propio.
- Cada instancia/generación tiene una entrada separada para no sobrescribir borradores de otra terminal. Al abrir el editor se pueden recuperar entradas anteriores; cancelar conserva esas entradas.
- La persistencia es diferida (300 ms, con un máximo de dos segundos durante edición continua), y se solicita también al cambiar de vista. Una terminación abrupta puede perder los últimos cambios aún no persistidos.

## Límites del MVP

- Solo proyectos locales; sin creación/renombrado/eliminación, búsqueda global, Git, formateo ni previews. Markdown se abre como texto editable.
- Pestañas de documentos propias, no mezcladas con las pestañas nativas de sesiones.
- Hasta 64 archivos abiertos; límites y validación segura de OEC: 2 MiB al leer/guardar, rechazo de binarios/UTF-8 inválido y protección de rutas y symlinks.
- Borradores limitados a 16 MiB por snapshot. Si se excede o falla el storage, se muestra un error; guardar archivos antes de salir.
- El historial nativo de deshacer pertenece al textarea y se reinicia al cambiar de archivo o desmontar la vista. Contenido, cursor y scroll sí se conservan.
- La posición exacta de la conversación al volver depende de OpenCode. No se modifica su historial ni se crean sesiones para representar archivos.

## Verificación

```powershell
bun run typecheck
bun run plugin:test
bun run test
bun run build
bun run plugin:build
bun run plugin:preflight opencode-editor-v0.1.2
bun run plugin:pack:check
```

Smoke opcional contra un ejecutable real de OpenCode 2, después de compilar el plugin:

```powershell
bun run plugin:smoke "C:/ruta/opencode.exe" plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-0.1.2.tgz
# Además, comprobar detección automática y confirmación del acceso local:
bun run plugin:smoke "C:/ruta/opencode.exe" plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-0.1.2.tgz --auto-root
```

El pack-check instala el tarball con npm y con Arborist (el resolvedor del anfitrión), sin omitir peers, y comprueba que solo se instaló el plugin. El smoke usa ese tarball instalado por Arborist fuera del checkout, configuración/datos temporales y `--standalone`; crea una sesión temporal sin enviar prompts, abre archivos desde el sidebar mediante teclado, edita, comprueba Enter/Tab, duplicación y páginas, guarda con `Ctrl+S` y regresa a la misma sesión. Comprueba conservación de documentos, pestañas y opciones F6/F7. El observer no importa ni sustituye la entrada del plugin. No modifica la instalación, configuración global ni portapapeles del usuario. Tras publicar, el mismo smoke acepta `@2jmalvarez/opencode-editor@0.1.1` en lugar del tarball.

## Publicaciones

Ver [RELEASING.md](RELEASING.md) para el bootstrap inicial, Trusted Publishing y futuras versiones. El workflow independiente solo responde a tags `opencode-editor-v*`; nunca usar `v0.1.0`, que activa la publicación de OEC autónomo.
