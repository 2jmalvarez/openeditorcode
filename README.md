# openeditorcode (OEC)

Editor de proyectos de codigo abierto para consola. Es una aplicación autónoma escrita en TypeScript con Bun y OpenTUI; no necesita OpenCode, servidor ni conexión externa.

La referencia completa está en [docs/manual.md](docs/manual.md); la instalación npm también ofrece `man oec` en Unix. Desde OEC, `Ctrl+P` incluye **Editar configuración de OEC** y **Abrir manual de OEC**.

## Vista principal

Al iniciar sin documentos abiertos, OEC muestra el explorador y, cuando hay al menos 144 columnas disponibles, también el panel de cambios. `Ctrl+B` y `Ctrl+Alt+B` muestran u ocultan cada lateral, mientras que `Ctrl+Shift+←/→` mueve el foco entre paneles. Debajo se muestran los demás atajos organizados por capacidad. Si el área central queda más angosta que el explorador, la ayuda se oculta y solo se muestra `OEC` en vertical.

![Pantalla principal de OpenEditorCode](docs/images/welcome-screen.png)

## Características

- Explorador virtualizado con iconos por tipo de archivo, selección por teclado y scroll vertical que sigue la selección incluso en proyectos grandes.
- Explorador operable con ratón: clic para seleccionar, expandir carpetas o abrir archivos.
- Creación de archivos en la carpeta seleccionada, sin sobrescribir archivos existentes.
- Varias pestañas abiertas, cambio circular y pestañas clicables con cierre mediante `×`, incluidos diffs Git identificados con `Δ`.
- Editor multilinea con números de línea, resaltado básico para archivos de código, ajuste de línea, deshacer y rehacer.
- Preview Markdown de solo lectura por defecto, con `Ctrl+Alt+M` para alternar entre preview y edición; el manual interno nunca se puede editar.
- Preview de PNG, JPEG, WebP y GIF en Kitty/Sixel cuando están disponibles, con fallback de bloques de terminal.
- Copia mediante OSC 52 y pegado desde el portapapeles de Windows, Wayland o X11.
- Búsqueda local lineal con resultados, navegación por flechas y aplicación con `Enter`.
- Búsqueda global concurrente, persistente y agrupada por archivo, con índice reutilizable de hasta 50.000 entradas.
- Conteo de líneas por archivo y total del proyecto.
- Confirmación modal para cambios sin guardar.
- Eliminación confirmada de archivos y carpetas desde el explorador.
- Panel de cambios Git virtualizado, con numeración, total de archivos y estadísticas de líneas añadidas/eliminadas, actualización automática local y vista diff de solo lectura.
- Navegación y atajos globales aislados del textarea para evitar modificaciones involuntarias al abrir, cerrar o cambiar archivos.
- Protección contra rutas externas, binarios y archivos de más de 2 MB.

## Requisitos

- Windows x64 o Linux x64 con glibc (Ubuntu, Debian, Fedora y derivados).
- Bun 1.3 o posterior para desarrollo.
- Git instalado para el panel de cambios Git.
- En Linux, `wl-paste` (Wayland), `xclip` o `xsel` para pegar desde el portapapeles.

## Instalación

Instala OEC globalmente desde npm:

```bash
npm install -g openeditorcode
```

Después, abre el editor en el directorio actual o indica la carpeta del proyecto:

```bash
oec
oec /ruta/del/proyecto
openeditorcode
openeditorcode /ruta/del/proyecto
```

`oec` y `openeditorcode` son comandos equivalentes.

También puedes consultar la ayuda y la versión sin iniciar la interfaz:

```bash
oec --help
oec --version
```

OEC comprueba actualizaciones en segundo plano después de iniciar. Si hay una versión nueva, la muestra junto a la versión actual y añade **Actualizar OEC** a `Ctrl+P`. La actualización cierra el editor antes de reemplazar el ejecutable y vuelve a abrir el mismo proyecto al finalizar.

La instalación npm incluye únicamente el lanzador y el binario de la plataforma actual; las dependencias de compilación no se instalan globalmente.

## Configuración e idioma

OEC mantiene su configuración fuera de los proyectos y fuera de la instalación npm, por lo que se conserva al actualizar:

- Windows: `%APPDATA%\openeditorcode\config.json`.
- Linux: `${XDG_CONFIG_HOME:-~/.config}/openeditorcode/config.json`.
- Entornos administrados o pruebas: `OEC_CONFIG_DIR` permite indicar el directorio de configuración.

Abre **Editar configuración de OEC** desde `Ctrl+P`. El archivo se valida al guardar y usa el esquema distribuido en [`docs/oec-config.schema.json`](docs/oec-config.schema.json). Incluye preferencias de idioma, layout, ajuste y números de línea, resaltado, respeto de `.gitignore`, actualización automática de Git, búsqueda de actualizaciones y previews.

El idioma predeterminado es el del sistema. `appearance.language` acepta `"auto"`, `"es"` y `"en"`.

Las configuraciones de versiones anteriores se migran automáticamente. Si el JSON es inválido, tiene valores incompatibles o impide iniciar OEC, se conserva la versión problemática en `config.bkp.json` y se restaura `config.json` con valores de fábrica. El backup es único y se reemplaza en cada recuperación; OEC muestra un aviso al iniciar tras una restauración.

Las exclusiones que se agregan con `Ctrl+E` son deliberadamente temporales: no se escriben ni en `.gitignore` ni en `config.json`.

## Ejecutar

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
.\openeditorcode\packages\oec-win32-x64\bin\oec.exe
```

## Uso básico

1. Pulsa `Ctrl+B` para mostrar u ocultar el explorador.
2. Usa las flechas para mover la selección.
3. Pulsa `Enter` para expandir una carpeta o abrir un archivo.
4. Usa `Tab` para alternar entre explorador, editor y cambios.
5. Guarda con `Ctrl+S`.

Al cerrar una pestaña modificada, el diálogo muestra **Guardar**, **Guardar y cerrar** y **Cerrar sin guardar** (opción predeterminada). Usa flechas arriba/abajo y confirma con `Enter`.

`Ctrl+F` es contextual: en el explorador filtra archivos de todo el proyecto por nombre y en el editor busca dentro del archivo abierto. `Esc` cancela y limpia cualquiera de las dos búsquedas. La búsqueda global conserva consulta, resultados y selección al abrir un resultado, reutiliza el índice durante la sesión y se limpia con `Esc` desde el modal.

Los Markdown (`.md`, `.markdown`, `.mdown` y `.mkd`) se abren como preview renderizado por defecto. `Ctrl+Alt+M` alterna entre la fuente editable y el preview, conservando los cambios sin guardar. El manual que se abre desde la paleta siempre permanece en preview y es de solo lectura. PNG, JPEG, WebP y GIF se muestran como previews de solo lectura; OEC prefiere Kitty o Sixel cuando el terminal lo soporta y usa bloques de terminal como fallback.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl+P` | Paleta de comandos, atajos y configuración |
| `Ctrl+Shift+←` | Mover el foco al panel de la izquierda |
| `Ctrl+Shift+→` | Mover el foco al panel de la derecha |
| `Ctrl+B` | Mostrar u ocultar el explorador de archivos |
| `Ctrl+Alt+B` | Mostrar u ocultar el control de cambios Git |
| `Ctrl+Shift+Enter` | Contraer todas las carpetas del panel activo |
| `F5` | Actualizar el panel activo; en Cambios revisa el estado local y ejecuta `git fetch` |
| `Supr` | Eliminar el archivo o carpeta seleccionado |
| `Ctrl+N` | Crear un archivo en la carpeta seleccionada |
| `Shift+Enter` | Alternar la carpeta seleccionada en explorador o cambios |
| `Ctrl+F` | Buscar archivos por nombre en el Explorador o texto en el Editor |
| `Ctrl+Alt+F` | Buscar texto en todos los archivos del proyecto |
| `Ctrl+E` | Editar exclusiones temporales desde un buscador de proyecto |
| `Ctrl+S` | Guardar archivo actual |
| `Ctrl+W` | Cerrar pestaña actual |
| `Shift+Tab` | Ir a la pestaña siguiente |
| `Ctrl+C` | Copiar el texto seleccionado |
| `Ctrl+V` | Pegar desde el portapapeles de Windows |
| `Ctrl+Z` | Deshacer el último cambio |
| `Ctrl+Shift+Z` | Rehacer el último cambio |
| `Ctrl+Alt+W` | Alternar ajuste de línea |
| `Ctrl+Alt+M` | Alternar preview y edición de Markdown |
| `Ctrl+L` | Ajustar líneas al ancho para ver el contenido completo |
| `Ctrl+Q` | Salir |
| `Tab` | Alternar explorador, editor y control de cambios |
| `Esc` | Cerrar una búsqueda o diálogo |

## Búsqueda y conteo

- `Ctrl+F` en el Explorador: escribe parte del nombre o ruta para filtrar archivos de todo el proyecto, incluso dentro de carpetas cerradas. Usa flechas para elegir uno, `Enter` para abrirlo y `Esc` para volver al árbol.
- `Ctrl+F` en el Editor: escribe el texto para ver todas las coincidencias locales. Usa flechas para elegir una y `Enter` para llevar el cursor a su inicio.
- `Ctrl+Alt+F`: escribe el texto y pulsa `Enter` para buscar en todo el proyecto. El primer uso construye un índice en memoria; los siguientes lo reutilizan. Tras obtener resultados, usa flechas para elegir uno y `Enter` para abrir el archivo en la línea coincidente.
- `Ctrl+E` dentro de la búsqueda de archivos o la búsqueda global abre las exclusiones de la sesión. Estas parten de `.gitignore`, autocompletan patrones y carpetas, y permiten incluir o excluir rutas sin modificar `.gitignore`. `.git` nunca se incluye.
- `Ctrl+P`: ejecuta **Calcular líneas del proyecto**. El explorador mostrará el conteo a la derecha de cada archivo y el pie mostrará el total final.
- El pie muestra un indicador giratorio mientras OEC abre, guarda, crea o elimina archivos, indexa, busca, cuenta líneas o actualiza el panel activo.

## Cambios Git

- `Ctrl+Alt+B` muestra el panel **CAMBIOS**. Los archivos preparados se separan en **STAGED** y el resto en **CAMBIOS**; ambos grupos usan las mismas flechas, `Enter` y `Shift+Enter` que el explorador.
- El encabezado muestra el total de entradas y cada cambio se numera y muestra sus líneas añadidas en verde y eliminadas en rojo. Un mismo archivo puede aparecer una vez en cada grupo; los binarios o estadísticas no disponibles se indican con `?`.
- Con el panel **CAMBIOS** activo, `F5` ejecuta `git fetch` y vuelve a comprobar los cambios locales y sus estadísticas aunque el fetch falle.
- OEC muestra el estado remoto de la rama disponible localmente. La paleta incluye **Actualizar referencias remotas de Git** para ejecutar `git fetch --quiet` manualmente.
- Los directorios sin seguimiento se expanden en archivos individuales. Abrir una entrada crea una pestaña `Δ` con el diff preparado o no preparado correspondiente, por lo que ambos pueden convivir para una misma ruta. Los diffs son de solo lectura y se pueden cerrar normalmente.

## Límites de seguridad

- Todas las rutas se validan contra la carpeta raíz seleccionada.
- No se abren ni procesan archivos binarios.
- El límite de lectura y análisis es 2 MB por archivo.
- Los previews de imágenes aceptan PNG, JPEG, WebP y GIF hasta 16 MB; formatos dañados o no compatibles se informan sin cerrar OEC.
- Los guardados usan un archivo temporal antes de reemplazar el original.
- Los archivos y carpetas definidos en `.gitignore` se muestran en gris y se excluyen del conteo y de los buscadores de proyecto. Las búsquedas permiten excepciones temporales durante la sesión; la carpeta `.git` permanece oculta y excluida siempre.

## Desarrollo, pruebas y distribución

```powershell
bun run typecheck
bun run test
bun run test:coverage
bun run build
bun run smoke:tui
```

`bun run build` genera el binario de la plataforma actual. También puedes ejecutar `bun run build:windows` o `bun run build:linux`. La CI exige cobertura mínima sobre la lógica de producto y arranca el ejecutable compilado hasta verificar su primer frame. La publicación de npm valida versiones, contenido de paquetes y binarios antes de distribuirlos según el sistema operativo. Consulta `AGENTS.md` para la arquitectura y pautas de mantenimiento.
