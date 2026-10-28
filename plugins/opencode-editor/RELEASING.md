# Releases del plugin OpenCode

Recuperación de `0.3.4`, cuarto intento [39606966281](https://github.com/2jmalvarez/openeditorcode/actions/runs/39606966281), snapshot `e06ac8b2319773fff4c4ef6946e3baa8f5b01c96`: toda la matriz Linux y Windows 2.1.x pasó, pero dos runners Windows fallaron antes de publicar. El clic Diff ya no falla: su test completó las aserciones y falló al borrar el sandbox (`EBUSY` por handles Git en cierre). La limpieza temporal ahora usa reintentos acotados de `rm`, sin repetir acciones de producto. Un runner también registró un error de guardado SVG; la prueba ahora abre F12 inmediatamente y adjunta los detalles técnicos al fallo, en vez de ocultarlos tras una espera agotada. No se modifica el guardado ni sus protecciones sin ese diagnóstico.

Este procedimiento publica únicamente `@2jmalvarez/opencode-editor`. En un release solo del plugin no cambiar versiones raíz/Windows/Linux ni `.github/workflows/publish.yml`; una publicación conjunta autorizada verifica ambos flujos. `dist/` no se versiona. El tarball contiene exactamente `package.json`, `dist/tui.js`, `dist/svg.wasm`, `dist/svg-font.ttf`, `tui.ts`, `README.md`, `LICENSE` y `THIRD-PARTY-NOTICES.txt`. Las dependencias OEC y el wrapper SVG se incluyen en el bundle; las APIs OpenCode/OpenTUI/Solid permanecen externas.

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

Release **`0.3.6` en preparación**: corrección de timeouts en Diff, conservación de resultados previos con aviso de datos desactualizados, caché de descubrimiento durante 30 segundos y plazos independientes de 10 segundos por repositorio con concurrencia acotada. `F5` fuerza redescubrimiento; el polling no acumula consultas pendientes. Publicación exclusiva del plugin; OEC autónomo permanece en `0.2.42`.

Release **`0.3.4` publicada por OIDC**, snapshot `84643031df30cbd4ee5552701012465eb49a8986`, [workflow](https://github.com/2jmalvarez/openeditorcode/actions/runs/39608347412): preview SVG/F4 con recursos portátiles, filtro literal de contenido en Files con Ctrl+F, Markdown compartido, paneles expanded/compact, cabeceras Files/Diff, colores Git y acciones contextuales en Ctrl+P. La matriz de ocho combinaciones Windows/Linux pasó con OpenCode 2.0.26/2.0.27/2.1.0/2.1.1. `npm view` confirmó versión y gitHead; `plugin:registry after` comparó el artefacto CI, integridad y provenance. Instalación por nombre verificada adicionalmente en Windows y WSL Linux con OpenCode 2.1.1: editor, carpeta automática, sidebar (SVG/contenido/Git/paleta) y las cuatro fases de permisos recordados.

**Cierre de verificación confirmado el 2026-10-21:** [39641519368](https://github.com/2jmalvarez/openeditorcode/actions/runs/39641519368), snapshot de infraestructura `6103d7eb564ea3595d60dcc8cb8c4d0d913fd6f2`, pasó en Windows y Linux: typecheck, suites, builds, comparación del artefacto CI original contra el tag inmutable, integridad/provenance y smokes del paquete público con OpenCode 2.1.1 (editor, carpeta automática, sidebar y cuatro reinicios de permisos). `verify-published-opencode-editor.yml` tiene permisos de lectura y no publica: verifica el mismo paquete `0.3.4` del snapshot `84643031df30cbd4ee5552701012465eb49a8986`. El gate del sitio queda satisfecho; su despliegue se verifica por separado.

El workflow de publicación original sigue figurando fallido: la preparación npm Linux agotó 70 segundos con `NpmInstallFailedError` antes de cargar OEC, también en el diagnóstico [39639845848](https://github.com/2jmalvarez/openeditorcode/actions/runs/39639845848). DEBUG no mostró su causa interna. La ejecución exitosa no reprodujo el error ni necesitó el diagnóstico condicional de CLI/Arborist/conexiones; no afirmar una causa raíz ni una corrección definitiva del instalador. Se corrigieron por separado sincronización de pruebas SVG, limpieza temporal Windows y la comparación de revisiones del nuevo workflow: `--published` solo admite `after` y valida el tag, sin intentar sobrescribir `GITHUB_SHA`, reservado por Actions. Los tags y paquetes publicados permanecen intactos. OEC `0.2.41` está publicado y verificado por su workflow independiente [39602731440](https://github.com/2jmalvarez/openeditorcode/actions/runs/39602731440), snapshot `b5770842ee314522597534c8f0b9380ccb4b96f0`.

Primer intento conjunto sobre `c90033def7b82d36435bc9e153632188016666fe`: OEC [run 39601572453](https://github.com/2jmalvarez/openeditorcode/actions/runs/39601572453) y plugin [run 39601573260](https://github.com/2jmalvarez/openeditorcode/actions/runs/39601573260) fallaron antes de publicar. Linux detectó aserciones Git dependientes del idioma del sistema; Windows agotó una espera de UI durante el guardado SVG. La recuperación fija y restaura el idioma en esos fixtures y amplía únicamente la espera de finalización del guardado Windows, sin repetir operaciones ni omitir pruebas. Reubicar tags fallidos solo con las comprobaciones de ausencia, finalización y lease indicadas abajo.

Segundo intento del plugin sobre `b5770842ee314522597534c8f0b9380ccb4b96f0`: [run 39602731190](https://github.com/2jmalvarez/openeditorcode/actions/runs/39602731190) completó seis combinaciones, pero dos runners Linux fallaron en el fixture del clic que abre un diff antes de publicar. La recuperación usa coordenadas del renderable real y espera la navegación asíncrona con un límite explícito, sin repetir el clic ni omitir aserciones. La versión y tag de OEC se verifican de forma independiente y no se reubican por esta corrección de prueba del plugin.

Tercer intento sobre `bdc4581ccf2a95c2adbf545b3392a759c99f4942`: [run 39604106183](https://github.com/2jmalvarez/openeditorcode/actions/runs/39604106183) volvió a fallar antes de publicar. La reproducción Linux aislada confirmó una carrera real: el refresco Git puede destruir la fila entre pulsación y liberación, perdiendo `onMouseUp`. Diff ahora abre al pulsar, igual que Files; la regresión verifica apertura antes de soltar y reemplaza la fila durante el clic. Falló con el código anterior y pasó 15 ejecuciones Linux consecutivas con la corrección; suites plugin Windows/Linux y smoke del anfitrión pasaron. Dos pruebas standalone de guardado en Windows seguían esperando PowerShell: tienen un presupuesto de filesystem explícito de 20 segundos, sin reintentar guardados ni alterar las protecciones del producto. OEC `0.2.41` ya está publicado en `b577084` y su tag permanece inmutable.

Release **`0.3.3` confirmada** el 2026-10-20, commit `c51c62f620260fc3c0d700f45fa1c5122f89a850`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39444288606): Files del sidebar adaptable de 3 a 10 filas, con espacio reservado para seis MCP, contexto y Diff. Diff reduce su altura si falta espacio; scroll interno preservado y overflow general del anfitrión sin modificar. Incluye regresiones de presupuesto, resize y desbordamiento. Pasaron las ocho combinaciones Windows/Linux con OpenCode 2.0.26, 2.0.27, 2.1.0 y 2.1.1. Registro, `gitHead`, contenido, SRI y provenance coinciden con el artefacto CI; los smokes por nombre de editor, carpeta automática, sidebar y cuatro reinicios pasaron también desde Windows/OpenCode 2.1.1. SRI: `sha512-m4yNbbi2jsrkNTQ5UMLzArFtTHb7rlgHF42DlRV7d0uWS5ZiYe8fNOHgtOIEJXrxoVeBGFri4Vo463hZR01gaw==`. Tag y paquete publicados son inmutables. Versiones raíz/plataformas y configuración personal sin cambios.

Release **`0.3.2` confirmada** el 2026-10-20, commit `ff3858881b8052c4e66433ff9b190e6419973951`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39439610304): consentimiento local persistente opt-in por carpeta exacta/equipo/usuario, opción de permitir solo por TUI o denegar, y comando para olvidar permisos guardados sin perder documentos abiertos. Se mantienen las restricciones de workspaces remotos y el override explícito `localRoot`. El smoke de acceso reinicia cuatro TUIs aisladas para comprobar recordar, reutilizar, olvidar y volver a preguntar. Pasaron las ocho combinaciones Windows/Linux con OpenCode 2.0.26, 2.0.27, 2.1.0 y 2.1.1, incluida persistencia real entre procesos. Registro, `gitHead`, contenido, SRI y provenance coinciden con el artefacto CI; los smokes por nombre de editor, carpeta automática, sidebar y cuatro reinicios pasaron también desde Windows/OpenCode 2.1.1. SRI: `sha512-Q+mQgKwPzvJEGrgXid1IvPryt2/t+bHkwhy2aan+isls7BVSXJ9/twFUQlYAW+nIgKcpQdIxOvIpUVNjVEo9nw==`. El primer job publish publicó correctamente pero la instalación Linux inmediata falló con `NpmInstallFailedError`; el reintento verificó el paquete existente sin republicarlo y terminó correctamente. Tag y paquete publicados son inmutables. Versiones raíz/plataformas sin cambios.

Primer intento `0.3.2`: commit `ea178a86345ccab7753a2648c31f1f524fded7c4`, [run 39437248856](https://github.com/2jmalvarez/openeditorcode/actions/runs/39437248856). Seis combinaciones pasaron; dos jobs Windows fallaron solo durante la limpieza temporal del test de aislamiento de estilos (`EBUSY` al eliminar su directorio), después de sus aserciones. El job publish no se ejecutó. La recuperación añade reintentos acotados exclusivamente al `rm` de ese fixture, sin repetir ni omitir aserciones. Confirmar ausencia npm/GitHub Release, finalización de runs y lease remoto antes de reubicar el tag fallido.

Segundo intento: commit `bd87049f1f9b084e265669e341b2d8fbd8574562`, [run 39438441229](https://github.com/2jmalvarez/openeditorcode/actions/runs/39438441229). Siete combinaciones pasaron; Windows/OpenCode 2.1.0 volvió a fallar en ese mismo `rm` en menos de 100 ms: Bun 1.3.14 no aplicó los reintentos solicitados mediante `maxRetries`. Se reemplazan por un bucle explícito y acotado para errores transitorios de limpieza. El job publish tampoco se ejecutó; mantener las mismas comprobaciones de ausencia y lease para la recuperación.

Release **`0.3.1` confirmada** el 2026-10-20, commit `e8c192717ac4c5638e1395ebe34941b5dbb055fc`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39430329534): corrige el fallo de importación `SyntaxStyle requires an explicit resource owner` en OpenCode 2.1.0, usa estilos ligados al renderer y mantiene compatibilidad con OpenCode 2.0.26/2.0.27. SDK de desarrollo 2.1.0 y OpenTUI 0.6.6; las instancias del anfitrión permanecen externas. Incluye selección de palabras compatible con los endpoints de selección de OpenTUI 0.6, regresiones de importación y aislamiento entre renderers, y CI ampliada a 2.1.0. Las seis combinaciones Windows/Linux pasaron. Registro, `gitHead`, contenido, SRI y provenance coinciden con el artefacto CI; instalación por nombre, carpeta automática y sidebar verificados también desde Windows/OpenCode 2.1.0. SRI: `sha512-/cyYIm0+JvCEbv1zGnORk58kSujx/N2jiVfAy/YGJ49dCQBTbu3UmnYuDmK4kFTKpFOgsoZFxg1lqsq4spY/9w==`. El primer intento del job publish publicó correctamente pero falló la instalación Linux inmediata con `NpmInstallFailedError`; el reintento verificó el paquete existente sin republicarlo y terminó correctamente. Tag y paquete publicados son inmutables. Versiones raíz/plataformas sin incremento; no publica OEC autónomo.

Primer intento `0.3.1`: commit `76eef2f19fb8d0b4eb72bf7158a4ad542dee57e6`, [run 39429263667](https://github.com/2jmalvarez/openeditorcode/actions/runs/39429263667). Las cuatro combinaciones OpenCode 2.0.26/2.0.27 Windows/Linux pasaron; los dos jobs 2.1.0 fallaron antes de ejecutar el anfitrión porque el descargador conservaba una allowlist antigua. El job publish no se ejecutó. La recuperación centraliza las versiones admitidas y prueba su igualdad con la matriz CI, sin quitar ninguna verificación. Aplicar las comprobaciones de ausencia, finalización y lease antes de reubicar el tag fallido.

Release **`0.3.0` en preparación**, autorizada junto con OEC 0.2.39: Git local Windows/WSL, diffs en pestañas/F4, árboles Files/Diff con scroll estable, imágenes, Markdown preview, rename F2, búsqueda difusa/literal y paleta completa. F6 conserva paneles; F7 oculta Files entero, F8 alterna Diff (visible por defecto tras consentimiento). `filesBinding` y `diffBinding` son independientes. Esta publicación conjunta sí incrementa OEC/plataformas y actualiza el workflow OEC para el instalador PowerShell; no es el flujo plugin-only del encabezado.

Release **`0.2.2` confirmada** el 2026-10-19, commit `2a236c5087e009f9f38984582ddc22693f0fffa5`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39310541283): acordeones Files/Diff independientes y sin superposición; F6 muestra Files solo, F7 alterna Diff en conversación/editor. Defaults F6/F7 y nueva opción `diffBinding` (`filesBinding` es alias de compatibilidad). El smoke del sidebar comprobó colapso independiente, búsqueda de 80 resultados acotada y visor nativo desde el editor sin perder documentos. CI cubrió OpenCode 2.0.26/2.0.27 en Windows/Linux; instalación por nombre, SRI, contenido y provenance verificados también desde Windows. Tag y paquete publicados son inmutables. Versiones raíz/plataformas y configuración personal sin cambios.

Release **`0.2.1` confirmada** el 2026-10-19, commit `d8fe0842a4d064c594836d8a0342cf17a9eda150`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39304161290): guardado nativo WSL desde Windows, búsqueda jerárquica compartida en F6/sidebar, nombres largos con desplazamiento y `Ctrl+L` para ajuste visual. Registro, SRI y provenance coinciden con el artefacto CI; instalación por nombre comprobada en Linux y Windows, con editor, carpeta automática y sidebar. CI cubrió OpenCode 2.0.26/2.0.27 en ambos sistemas. La última etapa Linux por nombre requirió un reintento tras `NpmInstallFailedError`; el reintento verificó el artefacto existente sin republicarlo. Tag y paquete publicados son inmutables; versión raíz y paquetes de plataforma sin cambios.

Primer intento de `0.2.1`: [run `39303088388`](https://github.com/2jmalvarez/openeditorcode/actions/runs/39303088388), commit `aa27db4526b491bef9f9d63f2f2ec5cf152eb80e`. Tres entornos pasaron; Linux/OpenCode 2.0.26 detectó cinco aserciones españolas dependientes del idioma heredado en las pruebas de documentos e historial Git. El job publish no se ejecutó. La recuperación fija explícitamente español durante cada prueba de esas suites y restaura el idioma previo; no modifica el plugin ni omite verificaciones. Conservar ese commit/run como evidencia y aplicar las comprobaciones de ausencia y lease antes de reubicar el tag fallido.

Release **`0.2.0` confirmada** el 2026-10-19, commit `388aa11bf00f0905a7796e3d550c0923dc2a9421`, [workflow exitoso](https://github.com/2jmalvarez/openeditorcode/actions/runs/39262390491): búsqueda rápida y cambios automáticos en el sidebar, visor nativo, foco de chat/confirmación corregidos y protección de borradores/guardado. Registro, SRI y provenance coinciden con el artefacto CI; instalación por nombre comprobada en Linux y Windows. CI cubrió OpenCode 2.0.26/2.0.27 y Windows verificó también 2.0.32. El paso de instalación por nombre necesitó reintentos por propagación/descarga de npm; esos reintentos verificaron la versión existente, sin republicarla. El tag y el paquete publicados son ahora inmutables.

Intentos previos del run `39260152869` sobre `b54f34a395ed8d8df58f082fd3d633e701aff5a4`: Linux pasó, Windows detectó un bloqueo del guardado en el anfitrión aislado. La recuperación usa APIs .NET Framework sin autoload de módulos y lectura por cantidad exacta de bytes UTF-8 en vez de esperar EOF; conserva ACL y reemplazo seguro. El tag fallido solo puede reubicarse tras las comprobaciones de ausencia y lease descritas más abajo; no hubo publicación npm de ese artefacto.

Los smokes deben esperar el comando OEC antes de abrir Files desde la paleta y confirmar que existe el modal antes de inyectar Enter: una instalación npm lenta/fallida nunca debe convertir las teclas de prueba en un prompt del chat. Desde 0.2.2 F7 controla Diff, no Files. Las copias públicas de `0.2.0` no incluyen los scripts de prueba; esta protección del harness se mantiene en `main` para futuras verificaciones.

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
bun run plugins/opencode-editor/scripts/smoke-access.ts /absolute/path/opencode plugins/opencode-editor/dist/release/2jmalvarez-opencode-editor-<VERSION>.tgz
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
bun run plugins/opencode-editor/scripts/smoke-access.ts /absolute/path/opencode @2jmalvarez/opencode-editor@<VERSION>
```

5. Verificar que el `gitHead` es el commit del tag y que el paquete tiene provenance. Actions compara SRI del artefacto con el registro, descarga y verifica su contenido y prueba instalación por nombre. Conservar `pack.json`, tarball y `SHA256SUMS` del artefacto del run.
6. Solo tras el workflow exitoso y la instalación real, actualizar la web ES/EN: `plugin.commit` al commit publicado; no cambiar `product.commit/version`. Ejecutar `bun run build`, `bun run verify:docs`, `bun run verify:docs --plugin-source ../openeditorcode`; revisar escritorio/móvil, enlaces, buscador y copiar ejemplos; commit y push de documentación por el flujo existente.

## Prereleases, reintentos y fallos

- Tags anotados `opencode-editor-v0.1.1-beta.1` publican con dist-tag **next**, nunca latest. SemVer estable publica con latest. No se soporta metadata `+build` en tags de release.
- El workflow de publicación no tiene `workflow_dispatch`: se reintenta el mismo run con `gh run rerun <RUN_ID> --failed`, sin permitir publicar una revisión arbitraria. El workflow separado `verify-published-opencode-editor.yml` sí admite ejecución manual de solo lectura sobre el artefacto de un run publicado, vinculado al tag inmutable; no publica ni mueve tags.
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
      "package": "@2jmalvarez/opencode-editor@0.3.4",
      "options": {
        "toggleBinding": "f6",
        "filesBinding": "f7",
        "diffBinding": "f8",
        "explorerWidth": 30
      }
    }
  ]
}
```

Desde 0.1.2 se detecta automáticamente la carpeta de la sesión activa y se confirma acceso al disco local una vez por carpeta/TUI. Desde 0.3.2 se puede recordar explícitamente esa carpeta exacta para el equipo/usuario y olvidar el permiso desde la paleta (la autorización de la TUI actual sigue vigente hasta salir). Quitar `localRoot` de configuraciones anteriores para seguir cada proyecto. Conservarla como override absoluto sigue permitido. No inferir filesystem local desde servidor remoto. La carga por carpeta compilada sigue siendo alternativa. Desde 0.3.0 los defaults son F6/F7/F8; `filesBinding` controla Files y `diffBinding` controla Diff, ya no son alias. `npm install -g openeditorcode` instala únicamente el editor autónomo.
