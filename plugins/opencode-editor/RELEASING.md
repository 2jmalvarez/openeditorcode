# Releases del plugin OpenCode

Este procedimiento publica únicamente `@2jmalvarez/opencode-editor`. No cambiar las versiones raíz/Windows/Linux, ni `.github/workflows/publish.yml`. `dist/` no se versiona. El tarball contiene exactamente `package.json`, `dist/tui.js`, `tui.ts`, `README.md` y `LICENSE`. Las dependencias OEC se incluyen en el bundle; las APIs OpenCode/OpenTUI/Solid permanecen externas.

## Bootstrap inicial (intervención humana)

Estado confirmado el 2026-10-19: **`0.1.1` publicada por OIDC y verificada**, commit `a12887948ddcb4582341a95dd7326a4483ac0a4c`, tag `opencode-editor-v0.1.1`, [run exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39194432774). Integridad/provenance y smoke por nombre pasaron en Linux y en Windows con OpenCode 2.0.26/2.0.27. `0.1.0` fue publicada pero falló resolución de peers; no modificar sus contenidos ni su tag. La corrección `0.1.1` fue autorizada por el titular. Para futuras versiones, no anunciar éxito antes de completar las mismas verificaciones.

Regresión obligatoria desde `0.1.1`: `plugin:pack:check` instala el artefacto con npm y Arborist, sin `--legacy-peer-deps`, y exige que el árbol solo contenga el plugin. La API `@opencode/plugin` permanece externa y como dependencia de desarrollo de la raíz, no como peer publicado: el peer opcional de `0.1.0` hacía que Arborist seleccionase transitivamente OpenTUI nuevo e incompatible. OpenTUI/Solid conservan sus peers opcionales; la compatibilidad de OpenCode se documenta en `engines.opencode`. El smoke de tarball carga el paquete instalado real. El verificador de registro espera hasta tres minutos por versión/provenance con revalidación de caché.

npm requiere que el paquete exista antes de registrar confianza (`npm trust`); no hereda el Trusted Publisher de `openeditorcode`. La documentación actual permite staging de un paquete nuevo, que crea un placeholder público `0.0.0-stage`. Ese bootstrap requiere autorización excepcional y autenticación del titular del scope, con 2FA; no ejecutar un `npm publish` local como fallback.

**No stagear y rechazar `0.1.0` antes del release.** Ese método se intentó: al rechazar el único stage inicial, tanto la consulta pública del paquete como `npm trust list` devolvieron E404. No asumir que el placeholder o su confianza sobreviven al rechazo del último stage sin una versión real publicada.

Con autorización excepcional y autenticación npm resuelta por el titular, preparar un auxiliar **del mismo paquete**, versión `0.0.0-bootstrap.0`, en un directorio temporal. No cambiar la versión `0.1.0` del plugin. El auxiliar debe contener solo manifiesto, README que advierte no aprobarlo y LICENSE, sin código, dependencias ni scripts de instalación. Empaquetarlo con `npm pack --ignore-scripts --json`, inspeccionar archivos y verificar integridad. No subirlo al repositorio ni publicarlo con `npm publish`.

El titular stagea **ese tarball auxiliar**, reemplazando `RUTA_ABSOLUTA_AL_AUXILIAR.tgz` por la ruta preparada:

```powershell
# npm temporal: no reemplaza la CLI global. Requiere la sesión del titular y 2FA.
npm exec --yes --ignore-scripts --package=npm@11.21.0 -- npm stage publish "RUTA_ABSOLUTA_AL_AUXILIAR.tgz" --tag bootstrap --access public --registry=https://registry.npmjs.org
npm exec --yes --ignore-scripts --package=npm@11.21.0 -- npm stage list @2jmalvarez/opencode-editor --json --registry=https://registry.npmjs.org
```

**Mantener pendiente el auxiliar: no aprobarlo ni rechazarlo todavía.** Configurar el Trusted Publisher de la siguiente sección por la web npm y comprobar que quedó guardado. Se puede publicar una versión diferente mientras otra está stageada; la reserva de `0.0.0-bootstrap.0` no bloquea `0.1.0`.

Después, subir el tag anotado de la versión real autorizada y publicar **por GitHub Actions/OIDC**. Solo cuando el workflow, el registro y la instalación por nombre confirmen la versión correcta (`0.1.1` en esta recuperación), el titular puede rechazar el stage auxiliar con 2FA. Identificar exclusivamente el stage de `0.0.0-bootstrap.0`, no otra versión:

```powershell
npm exec --yes --ignore-scripts --package=npm@11.21.0 -- npm stage reject "ID_DEL_STAGE_AUXILIAR" --registry=https://registry.npmjs.org
npm view @2jmalvarez/opencode-editor@0.1.1 version --registry=https://registry.npmjs.org
```

Nunca ejecutar `npm stage approve` para el auxiliar ni `npm publish` local para `0.1.0`. Si falla la configuración o publicación, conservar el stage auxiliar pendiente y diagnosticar antes de borrarlo. No guardar ni compartir tokens/códigos 2FA con el agente; resolver la autenticación interactivamente por el titular. Si este bootstrap no está disponible, pedir autorización para otra excepción.

Fuentes oficiales:

- https://docs.npmjs.com/cli/v12/commands/npm-trust
- https://docs.npmjs.com/staged-publishing
- https://docs.npmjs.com/cli/v11/commands/npm-stage
- https://docs.npmjs.com/trusted-publishers
- https://opencode.ai/v2/docs/build/plugins/cli
- https://opencode.ai/v2/docs/cli/config

## Trusted Publisher por paquete

Con el workflow ya subido y el paquete existente, el titular configura npm → paquete → Settings → Trusted publishing:

- Provider: GitHub Actions
- Organization/user: `2jmalvarez`
- Repository: `openeditorcode`
- Workflow filename: `publish-opencode-editor.yml` (sin `.github/workflows/`)
- Environment: `npm`
- Allowed action: **npm publish** (staging solamente no autoriza publicación directa)

Revisar la configuración guardada y los permisos del scope. Una confianza nueva debe completar su primer publish dentro de dos días; si expira, el titular debe reemplazarla. No tocar las confianzas de los tres paquetes OEC.

GitHub: revisar el entorno `npm` y sus reglas de tags/aprobación. Si se restringen tags, conservar las reglas existentes para OEC y añadir `opencode-editor-v*`. No endurecer o cambiar el entorno compartido sin revisar el efecto sobre OEC. El workflow usa runners hospedados, Node 24, npm 11.5.1+ y Bun 1.3.14. Solo el job de publicación tiene `id-token: write`; no tiene `NPM_TOKEN` ni permisos de escritura GitHub. Provenance se genera por OIDC en el repositorio público (se solicita explícitamente también).

## Futuras versiones normales

Release **`0.2.1` en preparación**: guardado nativo WSL desde Windows, búsqueda jerárquica compartida en F6/sidebar, nombres largos con desplazamiento y `Ctrl+L` para ajuste visual. Cambios funcionales en `24cc7bc`; versión raíz y paquetes de plataforma sin cambios. Confirmar workflow, registro/provenance e instalación por nombre antes de anunciar la publicación.

Primer intento de `0.2.1`: [run `39303088388`](https://github.com/2jmalvarez/openeditorcode/actions/runs/39303088388), commit `aa27db4526b491bef9f9d63f2f2ec5cf152eb80e`. Tres entornos pasaron; Linux/OpenCode 2.0.26 detectó cinco aserciones españolas dependientes del idioma heredado en las pruebas de documentos e historial Git. El job publish no se ejecutó. La recuperación fija explícitamente español durante cada prueba de esas suites y restaura el idioma previo; no modifica el plugin ni omite verificaciones. Conservar ese commit/run como evidencia y aplicar las comprobaciones de ausencia y lease antes de reubicar el tag fallido.

Release **`0.2.0` confirmada** el 2026-10-19, commit `388aa11bf00f0905a7796e3d550c0923dc2a9421`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39262390491): búsqueda rápida y cambios automáticos en el sidebar, visor nativo, foco de chat/confirmación corregidos y protección de borradores/guardado. Registro, SRI y provenance coinciden con el artefacto CI; instalación por nombre comprobada en Linux y Windows. CI cubrió OpenCode 2.0.26/2.0.27 y Windows verificó también 2.0.32. El paso de instalación por nombre necesitó reintentos por propagación/descarga de npm; esos reintentos verificaron la versión existente, sin republicarla. El tag y el paquete publicados son ahora inmutables.

Intentos previos del run `39260152869` sobre `b54f34a395ed8d8df58f082fd3d633e701aff5a4`: Linux pasó, Windows detectó un bloqueo del guardado en el anfitrión aislado. La recuperación usa APIs .NET Framework sin autoload de módulos y lectura por cantidad exacta de bytes UTF-8 en vez de esperar EOF; conserva ACL y reemplazo seguro. El tag fallido solo puede reubicarse tras las comprobaciones de ausencia y lease descritas más abajo; no hubo publicación npm de ese artefacto.

Los smokes deben esperar el comando OEC antes de inyectar F7 y confirmar que existe el modal antes de inyectar Enter: una instalación npm lenta/fallida nunca debe convertir las teclas de prueba en un prompt del chat. Las copias públicas de `0.2.0` no incluyen los scripts de prueba; esta protección del harness se mantiene en `main` para futuras verificaciones.

Release 0.1.2 confirmada el 2026-10-19, commit `4ec990107c3c405bee4e8f1d38080fc171fd5495`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39198286708): carpeta automática por sesión con confirmación de acceso local y controllers independientes por raíz; `localRoot` es override opcional. `Ctrl+A` tiene comando de paleta y pruebas de scope. Pasaron registro/provenance, instalación por nombre y ambos smokes (override y `--auto-root`), también en Linux. Para futuras versiones ejecutar ambos antes y después de publicar; `--auto-root` omite `localRoot` y confirma mediante teclado.

1. Cambiar **solo** `plugins/opencode-editor/package.json:version`. Actualizar README/notas relacionadas; lockfile solo si cambian dependencias (este plugin no es un workspace instalado en el lock raíz).
2. Desde la raíz ejecutar, reemplazando `<VERSION>` y la ruta del host:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run plugin:build
bun run plugin:test
bun run plugin:preflight opencode-editor-v<VERSION>
bun run plugin:pack:check
bun run plugin:smoke /absolute/path/opencode plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-<VERSION>.tgz
bun run plugin:smoke /absolute/path/opencode plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-<VERSION>.tgz --auto-root
bun run plugins/opencode-editor/scripts/smoke-sidebar.ts /absolute/path/opencode plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-<VERSION>.tgz
```

3. Inspeccionar `git diff`, agregar únicamente archivos/hunks pertinentes y comprobar `git diff --cached`. No usar `git add .`; excluir trabajo ajeno, particularmente `packageManager` preexistente del manifiesto raíz.
4. Commit de release y push por el flujo de `main` del repositorio. Si hay protecciones, usar rama/PR y esperar integración, sin saltarlas. El tag debe apuntar al commit revisado que pertenece a `origin/main`:

```sh
git commit -m "Release OpenCode editor plugin <VERSION>"
git push origin main
git tag -a opencode-editor-v<VERSION> -m "OpenCode editor plugin <VERSION>"
git push origin opencode-editor-v<VERSION>
gh run list --workflow publish-opencode-editor.yml --limit 5
gh run watch <RUN_ID> --exit-status
npm view @2jmalvarez/opencode-editor@<VERSION> version dist.integrity gitHead --registry=https://registry.npmjs.org
bun run plugin:smoke /absolute/path/opencode @2jmalvarez/opencode-editor@<VERSION>
bun run plugin:smoke /absolute/path/opencode @2jmalvarez/opencode-editor@<VERSION> --auto-root
bun run plugins/opencode-editor/scripts/smoke-sidebar.ts /absolute/path/opencode @2jmalvarez/opencode-editor@<VERSION>
```

5. Verificar que el `gitHead` es el commit del tag y que el paquete tiene provenance. Actions compara SRI del artefacto con el registro, descarga y verifica su contenido y prueba instalación por nombre. Conservar `pack.json`, tarball y `SHA256SUMS` del artefacto del run.
6. Solo tras el workflow exitoso y la instalación real, actualizar la web ES/EN: `plugin.commit` al commit publicado; no cambiar `product.commit/version`. Ejecutar `bun run build`, `bun run verify:docs`, `bun run verify:docs --plugin-source ../openeditorcode`; revisar escritorio/móvil, enlaces, buscador y copiar ejemplos; commit y push de documentación por el flujo existente.

## Prereleases, reintentos y fallos

- Tags anotados `opencode-editor-v0.1.1-beta.1` publican con dist-tag **next**, nunca latest. SemVer estable publica con latest. No se soporta metadata `+build` en tags de release.
- No hay `workflow_dispatch`: se reintenta el mismo run con `gh run rerun <RUN_ID> --failed`, sin permitir publicar una revisión arbitraria.
- Concurrencia por tag, sin cancelar un publish activo. No sobrescribir tags de versiones publicadas. Si el primer intento falla antes del job publish y hay que corregir infraestructura, solo reubicar el tag fallido dentro de la autorización de release después de confirmar HTTP 404 de esa versión, ausencia de GitHub Release, finalización de todos los runs previos y valor exacto del tag remoto. Conservar el commit anterior y el run como evidencia; usar un tag anotado y push con `--force-with-lease=refs/tags/<TAG>:<OBJETO_ANTERIOR>`, nunca force incondicional. Si alguna comprobación no coincide, detenerse.
- El registro solo se considera ausente con HTTP 404; fallos de red/auth/5xx bloquean. Una versión existente no equivale a éxito: debe coincidir versión, commit, SRI y provenance. Si todo coincide, un retry verifica sin republicar y repite la instalación por nombre.
- Las versiones npm son inmutables. Si `0.1.0` salió defectuosa, informar y obtener autorización para incrementar; nunca republicar ni borrar a ciegas.
- Si falla bootstrap, OIDC o permisos, detenerse y pedir al titular la acción precisa. Un workflow creado o un paquete stageado **no** son un release exitoso.

## Configuración pública de OpenCode (solo después de confirmar npm)

Integrar este objeto en el array `plugins` del `cli.json` **global**, conservando ajustes y plugins existentes:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    {
      "package": "@2jmalvarez/opencode-editor@0.2.1",
      "options": {
        "toggleBinding": "f6",
        "filesBinding": "f7",
        "explorerWidth": 30
      }
    }
  ]
}
```

Desde 0.1.2 se detecta automáticamente la carpeta de la sesión activa y se confirma acceso al disco local una vez por carpeta/TUI. Quitar `localRoot` de configuraciones anteriores para seguir cada proyecto. Conservarla como override absoluto sigue permitido. No inferir filesystem local desde servidor remoto. La carga por carpeta compilada sigue siendo alternativa. Los defaults del código continúan siendo Ctrl+Alt+O/J. `npm install -g openeditorcode` instala únicamente el editor autónomo.
