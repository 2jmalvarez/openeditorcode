# OEC para OpenCode 2 · editor local

Plugin opcional dentro de este repositorio. No modifica OpenCode y no sustituye el ejecutable autónomo de OEC.

Paquete independiente: `@2jmalvarez/opencode-editor`, versión inicial preparada `0.1.0`.
**La primera publicación todavía no está confirmada.** No confundir un build o workflow con disponibilidad en npm.
`npm install -g openeditorcode` instala solamente OEC autónomo, no este plugin.

## Funciones

- Explorador de archivos en el panel derecho de la conversación, junto a las contribuciones existentes.
- Editor en una ruta propia, con explorador derecho y pestañas de archivos independientes de las pestañas de sesiones.
- Alternancia entre editor y conversación sin enviar prompts ni interrumpir al agente.
- Navegación con teclado y ratón; árbol virtualizado que mantiene visible la selección.
- Edición UTF-8, resaltado por línea, guardar, copiar/pegar, deshacer/rehacer y búsqueda literal local.
- Documentos, cursor y scroll conservados al alternar vistas y archivos.
- Confirmación al cerrar documentos modificados; detección de modificaciones externas y archivos eliminados.
- Recuperación de borradores después de reiniciar o recargar el plugin, siempre con selección explícita.

## Construcción

Desde la raíz de `openeditorcode`:

```powershell
bun install --frozen-lockfile
bun run plugin:build
```

El resultado es `plugins/opencode-editor/dist/tui.js`. Incluye los módulos OEC compartidos y sus dependencias de búsqueda de archivos; OpenTUI, Solid y la API de plugins se resuelven en el anfitrión.

Probado con OpenCode **2.0.26 y 2.0.27**. Runtime Bun **1.3.14+**; peers OpenCode `^2.0.26`, OpenTUI `>=0.5.17 <0.6.0`, Solid `>=1.9.0 <2.0.0`. Los peers son opcionales para el instalador porque OpenCode provee las instancias en runtime; no son opcionales para ejecutar el plugin. No instalar una copia privada de OpenTUI/Solid dentro del plugin. El OEC autónomo conserva sus dependencias actuales.

## Cargar el plugin

Añadir esta entrada al array `plugins` del **`cli.json` global** de OpenCode, preservando sus demás valores. No existe `cli.json` de proyecto.

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    {
      "package": "C:/ruta/openeditorcode/plugins/opencode-editor",
      "options": {
        "localRoot": "C:/ruta/mi-proyecto",
         "toggleBinding": "f6",
         "filesBinding": "f7",
        "explorerWidth": 30
      }
    }
  ]
}
```

En Linux usar rutas absolutas como `/home/usuario/openeditorcode/plugins/opencode-editor` y `/home/usuario/mi-proyecto`.

Una vez confirmada la publicación, el mismo objeto permite instalar por nombre cambiando solamente `package` a `@2jmalvarez/opencode-editor@0.1.0`. No usar solo el nombre como entrada: `options.localRoot` es obligatorio. OpenCode instala el paquete; no se necesita un `postinstall` ni compilar desde el checkout para usar el paquete publicado.

`localRoot` es obligatorio: autoriza acceso **al filesystem local de la terminal**, no al del servidor. El MVP admite una raíz por configuración; únicamente integra sesiones cuya `location.directory` coincide con esa raíz. No utilizarlo para editar un proyecto remoto, aunque su ruta textual coincida con una carpeta local. El acceso remoto requiere un backend RPC y no forma parte de este MVP.

Volver a cargar el plugin o reiniciar la TUI tras cambiar la configuración. El build debe existir antes de cargarlo.

## Uso

1. Abrir una sesión en el proyecto configurado.
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
bun run plugin:preflight opencode-editor-v0.1.0
bun run plugin:pack:check
```

Smoke opcional contra un ejecutable real de OpenCode 2, después de compilar el plugin:

```powershell
bun run plugin:smoke "C:/ruta/opencode.exe" plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-0.1.0.tgz
```

Usa el tarball real extraído fuera del checkout, configuración/datos temporales y `--standalone`; crea una sesión temporal sin enviar prompts, abre archivos desde el sidebar mediante teclado, edita, comprueba Enter/Tab, duplicación y páginas, guarda con `Ctrl+S` y regresa a la misma sesión. Comprueba conservación de documentos, pestañas y opciones F6/F7. El observer no importa ni sustituye la entrada del plugin. No modifica la instalación, configuración global ni portapapeles del usuario. Tras publicar, el mismo smoke acepta `@2jmalvarez/opencode-editor@0.1.0` en lugar del tarball.

## Publicaciones

Ver [RELEASING.md](RELEASING.md) para el bootstrap inicial, Trusted Publishing y futuras versiones. El workflow independiente solo responde a tags `opencode-editor-v*`; nunca usar `v0.1.0`, que activa la publicación de OEC autónomo.
