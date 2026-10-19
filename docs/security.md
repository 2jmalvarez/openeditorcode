# Security and privacy / Seguridad y privacidad

These safeguards describe the current source tree, not a claim that older
published versions contain them. No editor is a sandbox: use an unprivileged
account and open only projects you trust. Git can invoke configured hooks,
filters and credential helpers; external formatters run with your permissions.

## Files

- Project file helpers check lexical and physical root containment, reject
  binary/invalid UTF-8 text and limit text documents to 2 MiB.
- Atomic saves create unpredictable exclusive temporary files. On POSIX the
  temporary starts at `0600` and the original permission bits are restored
  before replacement. New files remain private. Extended POSIX ACLs, ownership
  and concurrent hostile filesystem mutations are not sandboxed by this check.
- On Windows, the system PowerShell applies the target ACL to the empty
  temporary before receiving content. .NET `File.Replace` preserves the target
  security descriptor; failure aborts the save without an insecure fallback.
  A new saved file is restricted to the current identity. Creating an empty
  file through the explorer inherits the parent directory ACL until first save.
- Do not keep secrets in a directory readable/writable by untrusted users.

## Plugin recovery drafts

The plugin keeps unsaved document text **and its original baseline** in the
host's durable storage, outside the project. OEC does not encrypt that storage
or guarantee its filesystem permissions, backups, sync destinations or secure
erasure. Protect the host's data directory and backups accordingly.
The plugin uses the host's Solid/OpenTUI instances rather than bundling private
copies; keeping OpenCode and its runtime dependencies patched is also required.

Configure the plugin options in the global OpenCode configuration:

```json
{
  "drafts": {
    "enabled": false,
    "exclude": ["private/**", "**/service-account*.json"]
  }
}
```

- Persistence defaults to enabled for ordinary files. `.env`, `.env.*`, `*.env`,
  private-key/certificate extensions, SSH key names, `.npmrc`, `.pypirc`,
  `credentials*`, `.aws/` and `.ssh/` are excluded by default.
- Custom exclusions are additional, project-relative gitignore patterns; `!`
  negations are rejected so they cannot re-enable default sensitive exclusions.
- Excluded files remain editable and savable; they simply have no new recovery
  copies. Filename exclusions are not content scanning and do not detect secrets
  in ordinary source files or innocently named aliases. Disable drafts entirely
  for sensitive projects. Reload the plugin after changing options.
- Disabling persistence or adding exclusions does **not silently delete older
  drafts**. To remove them, use **OEC: delete stored drafts for this project**
  in the palette, then confirm. Open documents and project files are untouched.
  Open unsaved ordinary documents may generate new drafts afterwards unless
  persistence is disabled. Old host backups/synchronized copies are not erased.
- Cancelling recovery preserves previous user work. No recovery writes a file
  into the project until the user explicitly saves it.

## Logs and network

Logs are bounded and kept in process memory. All displayed log fields redact
common token formats, authorization headers, credential-bearing URLs, private
key blocks and common password/token assignments. This is best effort, not a
guarantee for arbitrary secret formats: inspect logs before sharing them.

The standalone npm launcher may query the public npm registry for updates;
`updates.checkOnStartup: false` disables the startup check. Git fetch/pull/push
use your configured remotes and Git credential handling. OEC does not bundle
your local credentials into the distributed application.

## Distribution checks

- `bun audit` must pass. Solid was updated to use patched Seroval; Babel is
  overridden within major 7 because the current OpenTUI build dependency pins
  an older vulnerable version. Brace-expansion 2 was patched within its major,
  keeping the separate version 5 dependency intact.
- Both publication workflows require the reusable secret-scanning job. It
  verifies the scanner with a synthetic token, scans full reachable Git history
  and the working tree, and redacts findings. Dependency auditing also runs in CI.
- Checkout credentials are not persisted. Actions are pinned to commit SHAs;
  OIDC write permission belongs only to the publishing jobs. Review updates to
  these pins and enable required checks/environment approval in GitHub settings.
- `bun run pack:check` rejects missing, empty, duplicate or unexpected entries
  in the standalone packages; the plugin has its own strict tarball checks.
- `.gitignore` is only an accident-prevention aid. Never rely on it to revoke a
  leaked secret or hide a file already committed to Git.

## Español

Los borradores del plugin pueden contener código y credenciales del archivo
original. Para un proyecto sensible, desactivarlos con `drafts.enabled: false`.
Las exclusiones por nombre no detectan secretos dentro de cualquier archivo.
Para eliminar copias antiguas, usar el comando de paleta **OEC: delete stored
drafts for this project** y confirmar; cambiar la configuración no borra trabajo
anterior silenciosamente. Las copias de seguridad del anfitrión son independientes.

Los logs ocultan formatos habituales de secretos, pero hay que revisarlos antes
de compartirlos. Si se filtró una credencial, revocarla/rotarla en su proveedor:
borrarla del repositorio no la invalida. No ejecutar OEC como administrador/root
ni considerar un proyecto desconocido como contenido seguro.
