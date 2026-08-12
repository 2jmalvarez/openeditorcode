# openeditorcode (OEC)

Editor de texto y explorador de proyectos para Windows Terminal. Es una aplicación autónoma de consola escrita en TypeScript con Bun y OpenTUI; no necesita OpenCode, servidor ni conexión externa.

## Características

- Explorador de carpetas con iconos por tipo de archivo, selección por teclado y scroll vertical que sigue la selección.
- Creación de archivos en la carpeta seleccionada, sin sobrescribir archivos existentes.
- Varias pestañas abiertas y cambio circular entre ellas.
- Editor multilinea con números de línea, resaltado básico para archivos de código, ajuste de línea, deshacer y rehacer.
- Copia mediante OSC 52 y pegado desde el portapapeles de Windows.
- Búsqueda dentro del archivo actual y búsqueda global en el proyecto.
- Conteo de líneas por archivo y total del proyecto.
- Confirmación modal para cambios sin guardar.
- Protección contra rutas externas, binarios y archivos de más de 2 MB.

## Requisitos

- Windows Terminal recomendado.
- Bun 1.3 o posterior.

## Ejecutar

Desde la carpeta del proyecto `openeditorcode`:

```powershell
bun install
bun run dev
```

Para abrir otro proyecto:

```powershell
bun run dev -- C:\ruta\del\proyecto
```

Sin argumento, abre el directorio actual. Si se ejecuta desde la carpeta padre, usa la ruta completa del ejecutable:

```powershell
.\openeditorcode\dist\oec.exe
```

## Uso básico

1. Pulsa `Ctrl+B` para enfocar el explorador.
2. Usa las flechas para mover la selección.
3. Pulsa `Enter` para expandir una carpeta o abrir un archivo.
4. Usa `Tab` para alternar entre explorador y editor.
5. Guarda con `Ctrl+S`.

Al cerrar una pestaña modificada, el diálogo muestra **Guardar**, **Guardar y cerrar** y **Cerrar sin guardar** (opción predeterminada). Usa flechas arriba/abajo y confirma con `Enter`.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl+P` | Paleta de comandos, atajos y configuración |
| `Ctrl+B` | Enfocar el explorador de archivos |
| `F5` | Actualizar el explorador de archivos |
| `Supr` | Eliminar el archivo o carpeta seleccionado |
| `Ctrl+N` | Crear un archivo en la carpeta seleccionada |
| `Shift+Enter` | Contraer la carpeta seleccionada en el explorador |
| `Ctrl+Shift+Enter` | Contraer todas las carpetas en el explorador |
| `Ctrl+F` | Buscar texto en el archivo abierto |
| `Ctrl+Alt+F` | Buscar texto en todos los archivos del proyecto |
| `Ctrl+S` | Guardar archivo actual |
| `Ctrl+W` | Cerrar pestaña actual |
| `Shift+Tab` | Ir a la pestaña siguiente |
| `Ctrl+C` | Copiar el texto seleccionado |
| `Ctrl+V` | Pegar desde el portapapeles de Windows |
| `Ctrl+Z` | Deshacer el último cambio |
| `Ctrl+Shift+Z` | Rehacer el último cambio |
| `Ctrl+Alt+W` | Alternar ajuste de línea |
| `Ctrl+L` | Ajustar líneas al ancho para ver el contenido completo |
| `Ctrl+Q` | Salir |
| `Tab` | Alternar explorador y editor |
| `Esc` | Cerrar una búsqueda o diálogo |

## Búsqueda y conteo

- `Ctrl+F`: escribe el texto y pulsa `Enter` para encontrar la siguiente coincidencia en el archivo actual.
- `Ctrl+Alt+F`: escribe el texto y pulsa `Enter` para buscar en todo el proyecto. Tras obtener resultados, usa flechas para elegir uno y `Enter` para abrir el archivo en la línea coincidente.
- `Ctrl+P`: ejecuta **Calcular líneas del proyecto**. El explorador mostrará el conteo a la derecha de cada archivo y el pie mostrará el total final.

## Límites de seguridad

- Todas las rutas se validan contra la carpeta raíz seleccionada.
- No se abren ni procesan archivos binarios.
- El límite de lectura y análisis es 2 MB por archivo.
- Los guardados usan un archivo temporal antes de reemplazar el original.
- Los archivos y carpetas definidos en `.gitignore` se muestran en gris y se excluyen del conteo y de la búsqueda global. La carpeta `.git` permanece oculta.

## Desarrollo, pruebas y distribución

```powershell
bun run typecheck
bun run test
bun run build
```

`bun run build` genera `dist\oec.exe` para Windows x64. Consulta `AGENTS.md` para la arquitectura y pautas de mantenimiento.
