# OEC para OpenCode 2 · editor local

Plugin opcional dentro de este repositorio. No modifica OpenCode y no sustituye el ejecutable autónomo de OEC.

Paquete independiente: **[`@2jmalvarez/opencode-editor@0.3.3`](https://www.npmjs.com/package/@2jmalvarez/opencode-editor/v/0.3.3)**. Publicación mediante GitHub Actions/OIDC con verificación de integridad/provenance e instalación real por nombre. Los smokes cubren editor, carpeta automática y sidebar con acordeones, búsqueda, Git, imágenes, foco y scroll. El historial de publicaciones verificadas está en [RELEASING.md](RELEASING.md). `0.1.0` tuvo un conflicto de peers.
`npm install -g openeditorcode` instala solamente OEC autónomo, no este plugin.

## Funciones

> Migración desde 0.2.2: `filesBinding` vuelve a controlar Files (`f7`); `diffBinding` controla Diff (`f8`). Si fijaste `diffBinding: "f7"`, actualizalo a `"f8"` para evitar conflictos.

En 0.3.0: **F6** alterna conversación/editor sin reiniciar paneles; **F7** muestra/oculta Files completo (cabecera, buscador y árbol) y **F8** muestra/oculta Diff, que está **visible por defecto** una vez autorizado el acceso al proyecto. Contraer Files desde su cabecera es una acción distinta: conserva la cabecera y no cambia su visibilidad F7. El selector compacto `Fuzzy ^E` / `Literal ^E` está a la derecha del buscador. Diff agrupa los cambios en un árbol de carpetas separado por una fila de Files cuando ambos están visibles.

- Explorador de archivos en el panel derecho de la conversación, junto a las contribuciones existentes.
- Buscador rápido encima de Files, por nombre o ruta y sin distinguir mayúsculas; incluye archivos de carpetas cerradas y respeta `.gitignore` y la exclusión de `.git`.
- Acordeones independientes **Files** y **Diff**, con áreas y scroll acotados para evitar superposición. Diff lee **Git local** de la raíz autorizada, sin depender de la detección del servidor OpenCode. Para rutas UNC WSL usa Git de esa distribución.
- Diffs en pestañas propias de solo lectura, con el componente público OpenTUI y tema del anfitrión, en vista dividida o unificada. `F4` abre el archivo actual para editar sin cerrar el diff ni restaurar versiones antiguas.
- Markdown con preview por defecto y `F4` para alternar edición/preview, incluso con contenido sin guardar. Imágenes PNG/JPEG/GIF/WebP en pestañas de solo lectura (límite 16 MiB).
- `F2` con foco en Files renombra archivos o carpetas y actualiza las rutas de sus pestañas abiertas, conservando ediciones. No sobrescribe destinos existentes.
- Búsqueda **Fuzzy / Literal** por nombre: `Ctrl+E` en el buscador. Fuzzy sigue siendo el default y usa toda la ruta; Literal busca texto consecutivo en el nombre (o en la ruta si la consulta contiene `/`). `Ctrl+F` o el selector alterna con contenido literal.
- `Ctrl+P` → **OEC: opencode-editor** → **All keyboard shortcuts** / **plugin configuration** muestran todos los controles y opciones. El menú permite cambiar preferencias durante la sesión sin escribir tu configuración personal.
- Editor en una ruta propia, con explorador derecho y pestañas de archivos independientes de las pestañas de sesiones.
- Alternancia entre editor y conversación sin enviar prompts ni interrumpir al agente.
- Navegación con teclado y ratón; árbol virtualizado que mantiene visible la selección.
- Edición UTF-8, resaltado por línea, guardar, copiar/pegar, deshacer/rehacer y búsqueda literal local.
- Documentos, cursor y scroll conservados al alternar vistas y archivos.
- `Ctrl+A` selecciona todo el contenido del archivo activo; también está en la paleta como **select all file contents**. Solo actúa con foco en el editor, sin búsqueda ni modal; no captura `Ctrl+A` del chat.
- Confirmación al cerrar documentos modificados; detección de modificaciones externas y archivos eliminados.
- Recuperación de borradores después de reiniciar o recargar el plugin, siempre con selección explícita.

### Novedades de 0.3.4 (en preparación, sin publicar)

- SVG abre en preview local estático; `F4` alterna XML editable y preview del borrador sin guardar. Un SVG inválido muestra un aviso y sigue permitiendo editar. Sin scripts, DTD, entidades ni recursos externos; texto hasta 2 MiB y raster hasta 1600 píxeles por dimensión. WASM, fuente y licencias se incluyen en el paquete.
- En Search files…, `Ctrl+F` o el selector `Fuzzy ^F` / `Literal ^F` / `Name ^F` alterna nombre/ruta y contenido. Contenido busca texto literal sin distinguir mayúsculas en disco, con resultados en árbol (primeros 80 archivos), respetando `.gitignore`, `.git`, binarios y límite de 2 MiB. `Ctrl+E` conserva Fuzzy/Literal para nombres; no cambia la búsqueda local del editor.
- `Ctrl+P` expone las nuevas acciones y las operaciones contextuales de Files/Diff, además de altura expanded/compact, expandir/contraer paneles, refrescar y limpiar búsqueda. Las acciones de edición solo están disponibles en su contexto.
- Markdown comparte presentación con OEC: títulos por nivel, links, tablas, código con etiqueta de lenguaje y sangría; adapta wrappers details/summary sin ejecutar HTML.
- Files y Diff muestran sus dos encabezados desde el inicio. Abrir cualquiera solicita autorización local cuando corresponde; dibujar los encabezados no lee archivos ni Git. La primera apertura de Diff conserva Files contraído.
- `panelHeight: "expanded"` usa el viewport real del sidebar, descontando título, Context/MCP y contenido adicional del anfitrión. No agrega scroll exterior cuando los paneles caben. `compact` conserva las alturas acotadas anteriores.
- Con ambos desplegados, sus listas y pistas de scroll tienen igual altura y alineación; el buscador y los mensajes de estado se descuentan antes de repartir. Una fila impar sobrante se ubica en la separación. Cada indicador móvil conserva su tamaño proporcional al contenido.
- Diff usa colores del tema: `+N` verde, `−N` rojo; `●` azul para staged, `○` verde para nuevos, rojo para eliminados y amarillo/advertencia para modificados o renombrados. En staged, la letra mantiene el color del tipo de cambio. Los símbolos y letras permanecen para no depender solo del color.

### Novedades de 0.3.3

- Files del sidebar usa entre 3 y 10 filas según la altura de la terminal, reservando espacio para seis MCP, contexto y Diff.
- Diff reduce su altura cuando falta espacio; cada árbol conserva su scroll interno. El scroll general sigue disponible si el contenido del anfitrión supera el espacio reservado.
- El layout del editor completo no cambia.

### Novedades de 0.3.2

- **Allow and remember this folder** conserva el permiso de una carpeta entre reinicios, limitado al equipo/usuario y a esa raíz exacta.
- Se mantienen las opciones de permitir solo por TUI o denegar, y las restricciones para workspaces remotos.
- **Forget remembered folder access** elimina permisos guardados sin cerrar documentos ni perder borradores; se vuelve a preguntar tras reiniciar.
- Pruebas reales de recordar, reiniciar, olvidar y volver a preguntar; matriz CI ampliada a OpenCode 2.1.1.

### Correcciones de 0.3.1

- Compatibilidad con OpenCode 2.1.0 / OpenTUI 0.6.6: estilos con propietario explícito, sin asignaciones nativas durante la importación y cachés independientes por renderer.
- Selección de palabras sin incluir espacios de más con la nueva semántica de selección de OpenTUI.
- Pruebas de regresión y matriz CI ampliada, conservando los anfitriones OpenCode 2.0.26/2.0.27.

### Novedades de 0.3.0

- Git local Windows/WSL, árbol de cambios y diffs en pestañas con F4 al archivo actual.
- F6 conserva paneles; F7 oculta Files completo; F8 controla Diff, visible por defecto tras el consentimiento.
- Preview Markdown/F4, imágenes y renombrado F2 conservando documentos y ediciones.
- Selector difuso/literal, rueda y scrollbar sin saltos, navegación por páginas y ayuda/configuración completa en Ctrl+P.

### Novedades de 0.2.2 (histórico)

- F6 alterna conversación/editor y deja **solo Files**; F7 muestra u oculta **Diff** sin ocultar Files, en ambas vistas.
- Cada acordeón se expande/contrae con clic, `Enter` o espacio. Al contraer Files se conserva su consulta, selección y árbol; contraer u ocultar Diff detiene su polling y suscripciones.
- Corregido el tamaño intrínseco del árbol: búsquedas con muchos resultados ya no invaden Diff. El editor reparte la altura disponible también en terminales bajas.
- Defaults F6/F7; `diffBinding` configura Diff. La opción anterior `filesBinding` se acepta como alias de `diffBinding`, no como atajo de Files.

### Novedades de 0.2.1

- Guardado desde Windows en rutas WSL mediante herramientas nativas Linux, conservando permisos, propietario y atributos; errores Windows legibles sin XML interno.
- Buscador también en F6; resultados dentro de su árbol de carpetas tanto en el editor como en la conversación.
- Nombres largos seleccionados con desplazamiento horizontal que se detiene al final.
- `Ctrl+L` alterna el ajuste visual de líneas largas sin modificar el contenido; conserva cursor y scroll al alternar vistas.

### Novedades de 0.2.0

- Búsqueda rápida sobre Files y cambios automáticos debajo, con acceso al visor nativo de OpenCode.
- Correcciones de foco del chat, navegación F7/Esc y confirmación inicial al soltar el mouse.
- Borradores con exclusiones de nombres sensibles, opciones de persistencia y eliminación explícita de copias almacenadas.
- Guardado que conserva permisos/ACL, compatible con Windows PowerShell iniciado desde PowerShell 7, y controles reforzados de publicación.

## Construcción opcional desde código

No es necesaria para instalar el paquete público desde OpenCode. Solo para la alternativa de carga por carpeta local.

Desde la raíz de `openeditorcode`:

```powershell
bun install --frozen-lockfile
bun run plugin:build
```

El resultado es `plugins/opencode-editor/dist/tui.js`. Incluye los módulos OEC compartidos y sus dependencias de búsqueda de archivos; OpenTUI, Solid y la API de plugins se resuelven en el anfitrión.

La matriz CI Windows/Linux cubre OpenCode **2.0.26, 2.0.27, 2.1.0 y 2.1.1**. También se verificó **2.0.32** en Windows con instalación por nombre. Runtime Bun **1.3.14+**; compatibilidad de anfitrión declarada en `engines.opencode` (`>=2.0.26 <3`, metadata informativa, no certificación de todas las versiones posteriores). OpenTUI `>=0.5.17 <0.7.0` y Solid `>=1.9.0 <2.0.0` son peers opcionales para el instalador porque OpenCode provee las instancias en runtime; no son opcionales para ejecutar el plugin. La API `@opencode/plugin` se declara solo como dependencia de desarrollo en la raíz de OEC: agregarla como peer del paquete publicado hace que Arborist atraviese sus peers opcionales y puede producir conflictos con versiones nuevas de OpenTUI. El loader provee esa API y el build la mantiene externa. No instalar copias privadas de OpenTUI/Solid. El desarrollo y el OEC autónomo usan OpenTUI **0.6.6** y los tipos de plugins **2.1.0**, alineados con OpenCode 2.1.0.

Los estilos nativos se crean después de disponer del renderer, con `renderer.nativeScene` como propietario explícito. No se asignan recursos nativos al importar módulos ni se comparten estilos entre renderers. Los anfitriones 2.0.x mantienen su implementación anterior, que ignora el argumento adicional.

## Cargar el plugin

### Carpeta automática desde 0.1.2

El plugin toma automáticamente la carpeta de la sesión activa de OpenCode; desde inicio usa `context.location` o la ubicación predeterminada del anfitrión. No usa la carpeta de instalación del plugin ni el directorio del servicio. Al cambiar de proyecto conserva documentos y borradores separados por raíz; volver al mismo proyecto recupera sus pestañas.

Añadir esta entrada al array `plugins` del **`cli.json` global** de OpenCode, preservando sus demás valores. No existe `cli.json` de proyecto. No se necesita clonar OEC ni compilar:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [{
    "package": "@2jmalvarez/opencode-editor@0.3.3",
    "options": { "toggleBinding": "f6", "filesBinding": "f7", "diffBinding": "f8", "explorerWidth": 30, "panelHeight": "expanded" }
  }]
}
```

El permiso recordado está disponible desde **0.3.2**; versiones anteriores vuelven a preguntar al reiniciar.

Al abrir los archivos de una carpeta desconocida, elegir el alcance del permiso **en esta computadora**:

- **Allow for this TUI only**: autoriza hasta cerrar OpenCode.
- **Allow and remember this folder**: recuerda esa carpeta entre reinicios, para este equipo/usuario. No autoriza otras carpetas ni subcarpetas abiertas como proyectos separados.
- **Deny access** o `Esc`: no abre archivos del proyecto.

La paleta **OEC: forget remembered folder access** permite elegir una carpeta y olvidar su permiso guardado. No cierra documentos ni descarta borradores: la autorización de la TUI actual sigue vigente y se vuelve a preguntar después de reiniciar. Un override `localRoot` explícito continúa autorizando esa ruta hasta quitarlo de `cli.json`.

Los permisos se guardan en el storage durable del anfitrión, fuera del proyecto, con alcance de equipo/usuario; no se escribe configuración personal automáticamente. La ubicación del servidor no prueba que exista un filesystem compartido: cancelar no lee archivos ni crea un workspace. Workspaces remotos requieren una `localRoot` explícita incluso si existe un permiso recordado; no se implementa lectura remota. Una ubicación ausente o relativa produce un aviso, sin recurrir silenciosamente a otra carpeta.

`localRoot` ya no es obligatoria desde 0.1.2. Si una configuración anterior conserva esa opción, quitarla para seguir automáticamente cada proyecto. Opcionalmente fijar `"localRoot": "C:/ruta/mi-proyecto"` (Linux: `/home/usuario/mi-proyecto`) para mantener el opt-in explícito de una sola raíz; solo integra sesiones cuya ubicación coincide con ella. No utilizarlo para editar proyectos remotos aunque sus rutas textuales coincidan con carpetas locales.

Para la alternativa local, compilar y reemplazar únicamente `package` por la ruta absoluta de `plugins/opencode-editor` dentro del checkout. No cargar simultáneamente las entradas npm y local del mismo plugin. Las versiones anteriores a 0.1.2 sí requieren `localRoot`.

Volver a cargar el plugin o reiniciar la TUI tras cambiar la configuración. El build debe existir antes de cargar la alternativa por carpeta local.

## Uso

1. Abrir una sesión en el proyecto deseado. Desde 0.1.2 se detecta automáticamente; confirmar acceso al disco local cuando se solicite.
2. `F7`, o **Show/hide Files** dentro del grupo **OEC: opencode-editor** en Ctrl+P, muestra/oculta toda la sección Files. Clic o `Enter`/espacio en su cabecera solo expande/contrae el acordeón. Al ocultar y volver a mostrar se conserva la expansión, consulta y posición. Diff aparece por defecto tras confirmar acceso y sigue independiente de Files.
3. Con foco en el árbol, las flechas navegan; `Enter` expande una carpeta o abre un archivo en el editor. Un clic también lo abre. El listado puede permanecer abierto mientras se escribe en el chat: no recupera el foco automáticamente.
4. `F6` o **toggle conversation/editor** alterna entre ambas vistas conservando paneles, pestañas y ediciones. `F7` muestra/oculta Files y `F8` muestra/oculta Diff. Ninguno afecta al otro panel.
5. `Ctrl+S` guarda; `Ctrl+W` cierra el archivo activo, con confirmación si está modificado.

Si OpenCode oculta su sidebar por falta de ancho, usar **toggle conversation/editor** en **OEC: opencode-editor**: el editor tiene su propio explorador. El plugin no fuerza el tamaño o la visibilidad del sidebar del anfitrión.

### Búsqueda rápida y cambios

- Tanto en F6 como en el panel de conversación: clic en **Search files…**, o `/` con foco en el árbol, para buscar. Los archivos coincidentes aparecen bajo sus carpetas padre, expandidas automáticamente. `↑`/`↓` navegan el árbol; `Enter` expande/contrae carpetas o abre archivos. Se muestran hasta 80 archivos coincidentes; el índice tiene un límite de 50.000 entradas. Limpiar la consulta restaura el árbol normal sin perder su selección y expansión.
- Los nombres largos seleccionados se desplazan horizontalmente tras una pausa y se detienen al mostrar el final. Cambiar de selección reinicia el desplazamiento.
- La rueda y la barra desplazan Files y Diff sin arrastrarlos de vuelta a la selección. Refrescar no cambia la posición manual. Con foco en el árbol, `Home`/`End` van a la primera/última fila y `RePág`/`AvPág` recorren una página; volver al teclado hace visible la selección. Files conserva por separado la posición del árbol normal y de los resultados de búsqueda.
- `Esc` limpia la búsqueda y vuelve al árbol; con el input vacío, devuelve el foco a la conversación. `F5` actualiza el índice. Los eventos de archivos invalidan la caché mientras el panel está visible.
- `Tab` desde el buscador enfoca el árbol sin limpiar los resultados; `/` desde el árbol enfoca el buscador. Desde el árbol, `Tab` enfoca Diff si está visible, o vuelve al editor/chat; `Shift+Tab` desde Diff vuelve a Files. En las cabeceras, `Enter`/espacio alternan el acordeón, `Tab`/`↓` entran a su contenido y `Esc` sale. `Esc` primero limpia una búsqueda activa; sin búsqueda, vuelve al editor o conversación.
- **Diff** muestra Git del proyecto, no solamente los archivos tocados por la sesión: `●` staged compara HEAD con el índice; `○` cambios compara índice con disco; `?` identifica archivos sin seguimiento. Un archivo puede aparecer en ambas áreas. No incluye ediciones aún no guardadas. Se actualiza con eventos y cada tres segundos mientras está visible y expandido; `F5` fuerza lectura local, sin fetch ni mutaciones. Ocultarlo o contraerlo detiene suscripciones y temporizadores.
- Clic o `Enter` abre el diff del archivo/área seleccionado en una pestaña del editor. Reabrir el mismo diff actualiza esa pestaña; staged y working tree tienen pestañas distintas. `F4` abre el archivo actual en edición conservando el diff. Si fue eliminado, avisa sin recrearlo. Diffs e imágenes no se guardan, no quedan modificados ni generan borradores.
- Diff organiza las carpetas con `Enter`/`→` para expandir y `←` para contraer o volver al padre; en un archivo, `Enter` abre su diff. Las carpetas se mantienen al refrescar y staged/working tree conservan identidades separadas. El plugin no ejecuta mutaciones Git ni consulta un servidor remoto como si fuera disco local.
- La confirmación inicial de acceso local permanece abierta al soltar el mouse; solo una respuesta explícita permite leer el proyecto.

| Acción | Atajo en el editor |
| --- | --- |
| Cambiar foco editor/explorador | `Tab` |
| Alternar conversación/editor conservando paneles | `F6` |
| Mostrar/ocultar Files | `F7` |
| Mostrar/ocultar Diff | `F8` |
| Diff → archivo actual / Markdown y SVG preview ↔ edición | `F4` |
| Alternar nombre/ruta ↔ contenido desde el buscador Files | `Ctrl+F` |
| Renombrar selección con foco en Files | `F2` |
| Alternar Fuzzy/Literal con foco en el buscador | `Ctrl+E` |
| Nueva línea | `Enter` / `Shift+Enter` |
| Insertar línea debajo / encima | `Ctrl+Enter` / `Ctrl+Shift+Enter` |
| Duplicar línea arriba / abajo | `Shift+Alt+↑` / `Shift+Alt+↓` |
| Mover línea arriba / abajo | `Alt+↑` / `Alt+↓` |
| Eliminar línea | `Ctrl+Shift+K` |
| Seleccionar palabra / todo | `Ctrl+D` / `Ctrl+A` |
| Inicio / final del archivo | `Ctrl+Home` / `Ctrl+End` |
| Inicio / final de línea | `Home` / `End` |
| Seleccionar hasta inicio / final de línea | `Shift+Home` / `Shift+End` |
| Seleccionar hasta inicio / final del archivo | `Ctrl+Shift+Home` / `Ctrl+Shift+End` |
| Mover / seleccionar por carácter o fila | Flechas / `Shift` + flechas |
| Borrar carácter anterior / siguiente | `Backspace` / `Supr` |
| Borrar palabra anterior / siguiente | `Ctrl+Backspace` / `Ctrl+Supr` |
| Borrar hasta inicio / final de línea | `Ctrl+U` / `Ctrl+K` |
| Moverse por palabras | `Ctrl+←` / `Ctrl+→` |
| Seleccionar por palabras | `Ctrl+Shift+←` / `Ctrl+Shift+→` |
| Avanzar por páginas | `RePág` / `AvPág` |
| Seleccionar por páginas | `Shift+RePág` / `Shift+AvPág` |
| Siguiente archivo | `Shift+Tab` |
| Guardar / cerrar archivo | `Ctrl+S` / `Ctrl+W` |
| Búsqueda literal local | `Ctrl+F` |
| Alternar ajuste visual de líneas largas (sin modificar el archivo) | `Ctrl+L` |
| Elegir coincidencia | `↑` / `↓`, después `Enter` |
| Cerrar búsqueda / volver al editor desde el árbol | `Esc` |
| Copiar / pegar | `Ctrl+C` / `Ctrl+V` |
| Deshacer / rehacer | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Actualizar árbol y comprobar cambios en el archivo | `F5` |

Los comandos se agrupan en **OEC: opencode-editor**, sin repetir OEC en cada título. `Ctrl+P` sigue perteneciendo al anfitrión. En edición aparecen los bindings reales de todas las acciones, incluidos los heredados del textarea (selección, navegación, borrado y aliases). **All keyboard shortcuts** incluye la lista completa. Desde la conversación también están disponibles acciones de guardar, F4, buscar, wrap y foco, con su atajo indicado en el título, pero no capturan esos atajos del chat. Los comandos de edición solo operan sobre documentos editables. `Esc` en el árbol de la conversación devuelve el control a OpenCode.

Dentro del editor, `Ctrl+Shift+←/→` selecciona por palabras; para cambiar de panel se usa `Tab`. `Ctrl+D` selecciona la palabra actual, sin multicursor. Duplicar/mover opera sobre la línea del cursor y se puede deshacer con `Ctrl+Z`. `Ctrl+C` copia solo la selección; `Ctrl+V` reemplaza la selección y conserva los saltos de línea del portapapeles. Si cambia el documento o cursor mientras se lee el portapapeles, la operación se cancela para no pegar en otro lugar.

Los defaults son **F6** (`toggleBinding`, conversación/editor), **F7** (`filesBinding`, Files) y **F8** (`diffBinding`, Diff). `filesBinding` ya no es alias de Diff; cada opción tiene una función independiente. Si configuraste explícitamente `diffBinding: "f7"`, cambialo a `"f8"` para evitar conflicto con Files. No se modifica la configuración del usuario automáticamente. Las notas de 0.2.2 arriba describen el comportamiento histórico de esa versión pública.

### Opciones: búsqueda, preview y vistas

Dentro de `plugins[].options` del **`cli.json` global** de OpenCode (no `opencode.json`):

```json
{
  "toggleBinding": "f6",
  "filesBinding": "f7",
  "diffBinding": "f8",
  "searchMode": "fuzzy",
  "markdownPreview": true,
  "diffView": "split",
  "imageProtocol": "auto"
}
```

- `searchMode`: `fuzzy` o `literal`.
- `markdownPreview`: `true` abre nuevos `.md`/`.markdown`/`.mdown` con formato; `false` en edición. Desde un diff, F4 siempre abre la fuente para editar.
- `diffView`: `split` o `unified`. No incrusta la pantalla privada de OpenCode: usa el componente público `diff` de OpenTUI en las pestañas OEC.
- `panelHeight`: `expanded` (predeterminado) ocupa la altura restante del sidebar: Files y Diff se reparten el espacio por igual; al contraer u ocultar uno, el otro ocupa el espacio libre. Si ambos están contraídos, solo quedan sus encabezados. También se aplica al editor, con scroll independiente. `compact` conserva las alturas acotadas anteriores. Se puede alternar desde **plugin configuration → Panel height**; para persistirlo, configurar esta opción en `cli.json`.
- `imageProtocol`: `auto` negocia las capacidades de la terminal y dispone de fallback; `blocks` fuerza celdas de color, útil con Windows Terminal/WSL sin protocolo gráfico compatible. También se aplica al preview SVG estático. No ejecuta HTML, scripts ni recursos remotos. Las imágenes corruptas muestran un aviso.
- **plugin configuration** dentro del grupo **OEC: opencode-editor** muestra también raíz, atajos, ancho y opciones de borradores; los cambios del menú aplican solo al controller del proyecto actual, hasta recargar el plugin. Para defaults persistentes, editar `cli.json` y reiniciar. No modifica ese archivo automáticamente.

Git solo ejecuta lecturas con argumentos separados, `--no-ext-diff` y `--no-textconv` para los patches, límites de salida y timeout. Se conserva la confirmación de acceso local; un workspace remoto necesita el override explícito `localRoot` y nunca se interpreta como acceso al disco remoto. Diffs de binarios o cambios de nombre/modo sin hunks muestran la descripción Git, no contenido editable.

## Cambios externos y recuperación

- Los archivos limpios se recargan al detectar cambios; los documentos con ediciones locales conservan sus contenidos y muestran un aviso.
- El archivo activo se comprueba al abrir el editor y cada tres segundos mientras la vista está montada.
- El guardado compara contra la última versión conocida en disco. No hay una opción de sobrescritura silenciosa.
- **OEC: reload file from disk** permite recargar tras confirmar el descarte de ediciones locales.
- Los archivos eliminados no se recrean automáticamente al guardar.
- En Windows, las rutas `\\wsl.localhost\Distribución\…` y `\\wsl$\Distribución\…` se guardan dentro de esa distribución mediante `wsl.exe`, preservando permisos, propietario y ACL/atributos Linux antes de escribir el contenido temporal. Requiere las herramientas estándar de GNU coreutils en la distribución. Los archivos Windows conservan su protección ACL habitual; no hay fallback que elimine permisos si falla el guardado.
- Los borradores guardan contenido y versión base en el storage durable del anfitrión, **fuera del proyecto**. Pueden contener código sensible: no son un almacén cifrado propio.
- En el código actual, `options.drafts.enabled: false` desactiva nuevas copias; `options.drafts.exclude` admite exclusiones adicionales tipo gitignore. `.env`, claves/certificados, credenciales y configuraciones de autenticación habituales se excluyen por defecto. Esto no detecta secretos dentro de archivos con otros nombres.
- Para borrar copias anteriores, usar **OEC: delete stored drafts for this project** y confirmar. No borra archivos ni ediciones abiertas; cambiar exclusiones/desactivar persistencia no elimina trabajo antiguo silenciosamente. Ver [seguridad y límites del almacenamiento](https://github.com/2jmalvarez/openeditorcode/blob/main/docs/security.md). Requiere una versión que incluya estos cambios; no modifica paquetes ya publicados.
- Cada instancia/generación tiene una entrada separada para no sobrescribir borradores de otra terminal. Al abrir el editor se pueden recuperar entradas anteriores; cancelar conserva esas entradas.
- La persistencia es diferida (300 ms, con un máximo de dos segundos durante edición continua), y se solicita también al cambiar de vista. Una terminación abrupta puede perder los últimos cambios aún no persistidos.

## Límites y diferencias con OEC autónomo

- Solo proyectos locales. Incluye renombrado F2, preview Markdown/SVG, imágenes, filtro por contenido y diffs de Git local en pestañas propias. No incluye creación/eliminación de archivos, búsqueda avanzada por líneas, mutaciones/historial Git ni formateo. No hereda automáticamente todas las capacidades de OEC autónomo.
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
bun run plugin:preflight opencode-editor-v0.3.3
bun run plugin:pack:check
```

Smoke opcional contra un ejecutable real de OpenCode 2, después de compilar el plugin:

```powershell
bun run plugin:smoke "C:/ruta/opencode.exe" plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-0.3.3.tgz
# Además, comprobar detección automática y confirmación del acceso local:
bun run plugin:smoke "C:/ruta/opencode.exe" plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-0.3.3.tgz --auto-root

# Cuatro TUIs aisladas: recordar, reiniciar sin preguntar, olvidar y volver a preguntar.
bun run plugins/opencode-editor/scripts/smoke-access.ts "C:/ruta/opencode.exe" plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-0.3.3.tgz
# Smoke de desarrollo del checkout compilado (no certifica el paquete publicado):
bun run plugins/opencode-editor/scripts/smoke-sidebar.ts "C:/ruta/opencode.exe"
# En un release, probar también el sidebar del tarball o paquete instalado:
bun run plugins/opencode-editor/scripts/smoke-sidebar.ts "C:/ruta/opencode.exe" "@2jmalvarez/opencode-editor@0.3.3"
```

El pack-check instala el tarball con npm y con Arborist (el resolvedor del anfitrión), sin omitir peers, y comprueba que solo se instaló el plugin. El smoke usa ese tarball instalado por Arborist fuera del checkout, configuración/datos temporales y `--standalone`; crea una sesión temporal sin enviar prompts, abre archivos desde el sidebar mediante teclado, edita, comprueba Enter/Tab, duplicación y páginas, guarda con `Ctrl+S` y regresa a la misma sesión. Comprueba conservación de documentos, pestañas y opciones F6/F7/F8. El observer no importa ni sustituye la entrada del plugin. No modifica la instalación, configuración global ni portapapeles del usuario. Tras publicar, el mismo smoke acepta `@2jmalvarez/opencode-editor@0.3.3` en lugar del tarball.

`smoke-sidebar.ts` valida consentimiento con mouse down/up, chat con Files abierto, acordeones independientes, F6 conservando paneles, F7 para Files, F8 para Diff en árbol, búsqueda masiva acotada, diffs en pestañas con F4, rename F2, preview Markdown e imágenes, paleta/atajos y actualización Git local. Sin segundo argumento usa el bundle del checkout; con un tarball lo instala mediante Arborist y con un nombre exacto lo carga desde npm mediante el anfitrión. Siempre usa una instancia privada con repositorio/sesión/configuración temporales; no envía prompts ni modifica la instalación o configuración del usuario.

## Publicaciones

Ver [RELEASING.md](RELEASING.md) para el bootstrap inicial, Trusted Publishing y futuras versiones. El workflow independiente solo responde a tags `opencode-editor-v*`; nunca usar `v0.1.0`, que activa la publicación de OEC autónomo.
