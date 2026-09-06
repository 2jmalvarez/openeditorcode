# openeditorcode (OEC)

[English](README.md) | Español

Sitio web: [openeditorcode.dev/es](https://openeditorcode.dev/es/)

Editor de proyectos de código abierto para terminal. Es una aplicación autónoma escrita en TypeScript con Bun y OpenTUI; no necesita OpenCode, servidor ni conexión externa.

La referencia completa está en [docs/manual.md](docs/manual.md); la instalación npm también ofrece `man oec` en Unix. Desde OEC, `Ctrl+P` incluye **Abrir configuración de OEC** y **Abrir manual de OEC**.

## Vista principal

Al iniciar sin documentos abiertos, OEC muestra el Explorador y, cuando hay al menos 144 columnas disponibles, tambien el panel de Cambios. `Ctrl+B` y `Ctrl+Alt+B` muestran u ocultan cada lateral, mientras que `Ctrl+Shift+Izquierda/Derecha` mueve el foco entre paneles. Debajo se muestran los demas atajos organizados por capacidad. Si el area central queda mas angosta que el Explorador, la ayuda se oculta y solo se muestra `OEC` en vertical.

![Pantalla principal de OpenEditorCode](docs/images/welcome-screen.png)

## Caracteristicas

- Explorador virtualizado con iconos por tipo de archivo, seleccion por teclado y scroll vertical que sigue la seleccion incluso en proyectos grandes.
- Interfaz operable con teclado y soporte complementario de raton en el Explorador, resultados de busqueda, Cambios y pestanas.
- Creacion de archivos en la carpeta seleccionada, sin sobrescribir archivos existentes.
- Varias pestanas abiertas, cambio circular, cierre clicable y pestanas de diff Git `Delta`.
- Editor multilinea con numeros de linea, resaltado basico para codigo, ajuste de linea, deshacer/rehacer y conservacion de finales LF/CRLF.
- Formateo integrado con `Alt+Shift+F`, Prettier para formatos web comunes, formateo al guardar opcional y formateadores externos configurables.
- Preview Markdown de solo lectura por defecto, con `F4` para alternar preview y edicion; el manual interno nunca se puede editar.
- Preview de PNG, JPEG, WebP y GIF en Kitty/Sixel cuando estan disponibles, con fallback de bloques de terminal.
- Copia mediante OSC 52 y pegado desde el portapapeles del sistema en Windows, Wayland y X11.
- Busqueda local literal y busqueda global concurrente con indice reutilizable de hasta 50.000 entradas.
- Conteo de lineas por archivo y del proyecto indexado.
- Confirmacion modal para cambios sin guardar, eliminacion y cambios externos detectados antes de guardar.
- Panel Git virtualizado con staging, commits, pull/push, diffs alineados de solo lectura, resaltado intralinea y marcadores laterales.
- Registro de errores de sesion mediante `F12`.
- Proteccion contra rutas externas, symlinks/junctions que salen de la raiz, UTF-8 invalido, binarios y archivos de mas de 2 MiB.

## Requisitos

- Windows x64 o Linux x64 con glibc (Ubuntu, Debian, Fedora y derivados).
- Node.js 18+ y npm para instalar e iniciar OEC desde npm.
- Bun 1.3 o posterior solo para desarrollo.
- Git para el panel de Cambios Git.
- En Linux, `wl-paste` (Wayland), `xclip` o `xsel` para pegar desde el portapapeles del sistema.

## Instalacion

Instala OEC globalmente desde npm:

```bash
npm install -g openeditorcode
```

Despues, abre el editor en el directorio actual o indica la carpeta del proyecto:

```bash
oec
oec /ruta/del/proyecto
openeditorcode
openeditorcode /ruta/del/proyecto
```

`oec` y `openeditorcode` son comandos equivalentes. Usa `--` antes de una ruta de proyecto que empiece por guion.

Tambien puedes consultar la ayuda y la version sin iniciar la interfaz:

```bash
oec --help
oec -h
oec --version
oec -V
```

OEC comprueba actualizaciones en segundo plano despues de iniciar. Si hay una version nueva, la muestra junto a la version actual. **Actualizar OEC** aparece en `Ctrl+P` solo si OEC se inicio mediante el lanzador npm; cierra el editor, instala el paquete mas reciente y vuelve a abrir el mismo proyecto.

La instalacion npm incluye unicamente el lanzador y el binario de la plataforma actual; las dependencias de compilacion no se instalan globalmente.

## Configuracion e idioma

OEC mantiene su configuracion fuera de los proyectos y fuera de la instalacion npm, por lo que se conserva al actualizar:

- Windows: `%APPDATA%\openeditorcode\config.json`.
- Linux: `${XDG_CONFIG_HOME:-~/.config}/openeditorcode/config.json`.
- Entornos administrados o pruebas: `OEC_CONFIG_DIR` permite indicar el directorio de configuracion.

Abre la paleta con `Ctrl+P` y selecciona **Abrir configuración** para modificar preferencias comunes desde la TUI o editar el JSON avanzado. Usa flechas arriba/abajo para elegir una preferencia, `Enter` para cambiarla, flechas izquierda/derecha para alternar entre ámbito global y proyecto, `E` para editar el JSON del ámbito activo y `Esc` para cerrar la pantalla. La configuración guardada se valida; consulta el esquema distribuido en [`docs/oec-config.schema.json`](docs/oec-config.schema.json). Incluye tema de sintaxis, formateo, atajos y el perfil Vim básico. Un proyecto puede sobrescribir preferencias en `.oec/config.json`; esos valores tienen prioridad, pero la configuración de proyecto no puede declarar ejecutables de formateadores externos.

Los atajos predeterminados de la tabla se pueden sobrescribir mediante `keyboard.bindings`. `keyboard.profile: "vim"` habilita modos Normal, Insert y Visual básicos; no es una emulación completa de Vim. La navegación compatible en Normal/Visual es `h`, `j`, `k`, `l`, `w`, `b`, `0` y `$`; el modo Normal también admite `i`, `a`, `v`, `u`, `x`, `dd` y `gg`.

El idioma predeterminado es el del sistema. `appearance.language` acepta `"auto"`, `"es"` y `"en"`.

Las configuraciones de versiones anteriores se migran automaticamente. Si el JSON es invalido, tiene valores incompatibles o impide iniciar OEC, se conserva la version problematica en `config.bkp.json` y se restaura `config.json` con valores de fabrica. El backup es unico y se reemplaza en cada recuperacion; OEC muestra un aviso al iniciar tras una restauracion.

Las exclusiones que se agregan con `Ctrl+E` son deliberadamente temporales: no se escriben ni en `.gitignore` ni en `config.json`.

## Ejecutar desde codigo fuente

Desde la carpeta del proyecto `openeditorcode`:

```powershell
bun install
bun run dev
```

Para abrir otro proyecto durante el desarrollo:

```powershell
bun run dev -- C:\ruta\del\proyecto
```

Sin argumento, abre el directorio actual. Tras compilar para Windows, el ejecutable queda en `packages\oec-win32-x64\bin\oec.exe`:

```powershell
.\packages\oec-win32-x64\bin\oec.exe
```

## Uso basico

1. Pulsa `Ctrl+B` para mostrar u ocultar el Explorador.
2. Usa las flechas para mover la seleccion.
3. Pulsa `Enter` para expandir una carpeta o abrir un archivo.
4. Usa `Tab` para alternar entre Explorador, Editor y Cambios.
5. Guarda con `Ctrl+S`.

Al cerrar una pestana modificada, el dialogo muestra **Guardar**, **Guardar y cerrar** y **Cerrar sin guardar** (opcion predeterminada). Usa flechas arriba/abajo y confirma con `Enter`. Si un archivo cambia fuera de OEC antes de guardar, puedes recargarlo, sobrescribirlo o cancelar.

`Ctrl+F` es contextual: en el Explorador filtra archivos de todo el proyecto por nombre y en el Editor busca dentro del archivo abierto. `Esc` cancela y limpia cualquiera de las dos búsquedas. La búsqueda global conserva consulta, resultados y selección al abrir un resultado, reutiliza el índice durante la sesión y se limpia con `Esc` desde el modal.

Los Markdown (`.md`, `.markdown`, `.mdown` y `.mkd`) se abren como preview renderizado por defecto. `F4` alterna entre la fuente editable y el preview, conservando los cambios sin guardar. El manual que se abre desde la paleta siempre permanece en preview y es de solo lectura. PNG, JPEG, WebP y GIF se muestran como previews de solo lectura; OEC prefiere Kitty o Sixel cuando el terminal lo soporta y usa bloques de terminal como fallback.

Cuando una operación falla, OEC conserva la operación, la hora y el detalle técnico en el registro de sesión. El pie indica `F12` mientras haya errores sin leer; `F12` o **Abrir registro de errores** desde la paleta abren una pestaña central de solo lectura que no se persiste al cerrar OEC.

## Paleta de comandos

Pulsa `Ctrl+P` para abrir la paleta de comandos, escribe para filtrar, usa las flechas para seleccionar y `Enter` para ejecutar. Desde ella puedes abrir la configuración global o del proyecto, el manual integrado, el registro de errores de sesión, el conteo de líneas del proyecto y la actualización de referencias remotas de Git. Cuando está disponible, también ofrece la actualización de OEC mediante npm.

## Atajos

| Atajo | Accion |
| --- | --- |
| `Ctrl+P` | Paleta de comandos, atajos y configuracion |
| `Ctrl+Shift+Izquierda` | Mover el foco al panel de la izquierda |
| `Ctrl+Shift+Derecha` | Mover el foco al panel de la derecha |
| `Ctrl+B` | Mostrar u ocultar el Explorador |
| `Ctrl+Alt+B` | Mostrar u ocultar Cambios Git |
| `Ctrl+Shift+Enter` | Contraer todas las carpetas del panel activo |
| `F5` | Actualizar el panel activo; en Cambios ejecuta fetch y relee el estado local |
| `F12` | Abrir el registro de errores de la sesion |
| `Supr` | Eliminar el archivo o carpeta seleccionado |
| `Ctrl+N` | Crear un archivo en la carpeta seleccionada |
| `Shift+Enter` | Alternar la carpeta seleccionada en Explorador o Cambios |
| `Ctrl+F` | Buscar archivos por nombre en el Explorador o texto en el Editor |
| `Ctrl+Alt+F` | Buscar texto en todos los archivos del proyecto |
| `Ctrl+E` | Editar exclusiones temporales desde un buscador de proyecto |
| `Ctrl+S` | Guardar archivo actual |
| `Ctrl+W` | Cerrar pestana actual |
| `Shift+Tab` | Ir a la pestana siguiente |
| `Ctrl+C` | Copiar el texto seleccionado |
| `Ctrl+V` | Pegar desde el portapapeles del sistema |
| `Ctrl+Z` | Deshacer el ultimo cambio |
| `Ctrl+Shift+Z` | Rehacer el ultimo cambio |
| `Alt+Shift+F` | Formatear el documento actual |
| `Ctrl+L` | Alternar ajuste de linea |
| `F4` | Alternar preview y edicion de Markdown |
| `Ctrl+Q` | Salir |
| `Tab` | Alternar Explorador, Editor y Cambios |
| `Esc` | Cerrar una busqueda o dialogo |

## Busqueda y conteo

- `Ctrl+F` en el Explorador: escribe parte del nombre o ruta para filtrar archivos de todo el proyecto, incluso dentro de carpetas cerradas. Usa flechas para elegir uno, `Enter` para abrirlo y `Esc` para volver al arbol.
- `Ctrl+F` en el Editor: escribe el texto para ver todas las coincidencias locales. Usa flechas para elegir una y `Enter` para llevar el cursor a su inicio.
- `Ctrl+Alt+F`: escribe el texto y pulsa `Enter` para buscar en todo el proyecto. El primer uso construye un indice en memoria; los siguientes lo reutilizan. Tras obtener resultados, usa flechas para elegir uno y `Enter` para abrir el archivo en la linea coincidente.
- `Ctrl+E` dentro de la busqueda de archivos o la busqueda global abre las exclusiones de la sesion. Estas parten del `.gitignore` de raiz, autocompletan patrones y carpetas, y permiten incluir o excluir rutas sin modificar `.gitignore`. `.git` nunca se incluye.
- `Ctrl+P`: ejecuta **Calcular lineas del proyecto**. El Explorador mostrara el conteo a la derecha de cada archivo y el pie mostrara el total indexado. El conteo y las busquedas pueden ser parciales al alcanzar el limite de 50.000 entradas.
- El pie muestra un indicador giratorio mientras OEC abre, guarda, crea o elimina archivos, indexa, busca, cuenta lineas o actualiza el panel activo.

## Cambios Git

- Git es opcional. `Ctrl+Alt+B` muestra el panel **CAMBIOS** cuando el proyecto es un repositorio Git. Los archivos preparados se separan en **STAGED** y el resto en **CAMBIOS**; usa flechas para seleccionar entradas y `Enter` para expandir o contraer carpetas y abrir diffs.
- El encabezado muestra la rama y su estado remoto: `actualizado`, `↑N` pendiente de push o `↓N` pendiente de pull. Cada cambio se numera y muestra sus lineas anadidas en verde y eliminadas en rojo. Un mismo archivo puede aparecer una vez en cada grupo; los binarios o estadisticas no disponibles se indican con `?`.
- `+` suma el archivo o todo el contenido de una carpeta a **STAGED**. `-` quita archivos de **STAGED** o descarta los cambios de **CAMBIOS** tras confirmar.
- Baja con `↓` desde el ultimo cambio para escribir el mensaje de commit; `Enter` crea el commit. `F6` ejecuta pull y `F7` ejecuta push.
- Con el panel **CAMBIOS** activo, `F5` ejecuta `git fetch` y vuelve a comprobar los cambios locales y sus estadisticas aunque el fetch falle.
- OEC muestra el estado remoto de la rama disponible localmente. La paleta incluye **Actualizar referencias remotas de Git** para ejecutar `git fetch --quiet` manualmente.
- Los directorios sin seguimiento se expanden en archivos individuales. Abrir una entrada crea una pestaña `Delta` con el diff preparado o no preparado correspondiente, por lo que ambos pueden convivir para una misma ruta. Cierra una pestaña diff con `Ctrl+W`. Los diffs son de solo lectura, alinean las líneas modificadas, resaltan fragmentos cambiados, sincronizan el scroll y muestran marcadores laterales. `layout.diffOrientation` acepta `auto`, `horizontal` o `vertical`; en `auto`, `layout.diffStackBelow` indica el ancho del terminal a partir del cual las dos versiones se apilan verticalmente.

## Limites de seguridad

- Todas las rutas se validan contra la carpeta raiz seleccionada; los symlinks y junctions no pueden salir de ella.
- Solo se abren y procesan archivos de texto UTF-8; se rechazan binarios, NUL y UTF-8 invalido.
- El limite de lectura y analisis es 2 MiB por archivo.
- Los previews de imagenes aceptan PNG, JPEG, WebP y GIF hasta 16 MiB; formatos danados o no compatibles se informan sin cerrar OEC.
- Los guardados usan un archivo temporal antes de reemplazar el original y preservan sus finales de linea.
- El `.gitignore` de raiz se muestra en gris en el Explorador y se excluye por defecto del conteo y de los buscadores de proyecto. No se leen `.gitignore` anidados, `.git/info/exclude` ni exclusiones globales Git. Las busquedas permiten excepciones temporales durante la sesion; la carpeta `.git` permanece oculta y excluida siempre.

## Desarrollo, pruebas y distribucion

```powershell
bun run typecheck
bun run test
bun run test:coverage
bun run build
bun run smoke:tui
```

`bun run build` genera el binario de la plataforma actual. Tambien puedes ejecutar `bun run build:windows` o `bun run build:linux`. Para comprobaciones de release y paquetes, usa `bun run preflight`, `bun run smoke:check` y `bun run pack:check`. La CI ejecuta los umbrales de cobertura configurados y arranca el ejecutable compilado hasta verificar su primer frame. La publicacion de npm valida versiones, contenido de paquetes y binarios antes de distribuir los paquetes por sistema operativo. Consulta `AGENTS.md` para la arquitectura y pautas de mantenimiento.
