#!/usr/bin/env bash
set -euo pipefail

# Keep all execution inside main: a truncated curl pipe cannot run half a script.
main() (
  # Subshell-scoped state survives errexit unwinding until the EXIT trap runs.
  locale=${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}} language=en
  case "$locale" in es|es_*|es.*|es-*) language=es ;; esac
  say() { if [[ $language == es ]]; then printf '%s\n' "$2"; else printf '%s\n' "$1"; fi; }
  fail() { say "Error: $1" "Error: $2" >&2; exit 1; }
  version='' modify_path=true
  while (($#)); do
    case "$1" in
      --version)
        (($# >= 2)) || fail 'Missing --version value.' 'Falta el valor de --version.'
        version=${2#v}
        [[ -n $version ]] || fail 'Invalid version.' 'Version no valida.'
        shift 2 ;;
      --no-modify-path) modify_path=false; shift ;;
      --help|-h)
        say 'Usage: bash install.sh [--version X.Y.Z] [--no-modify-path]' 'Uso: bash install.sh [--version X.Y.Z] [--no-modify-path]'
        return ;;
      *) fail "Unknown option: $1" "Opcion desconocida: $1" ;;
    esac
  done
  version_pattern='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$'
  [[ -z $version || $version =~ $version_pattern ]] || fail 'Invalid version.' 'Version no valida.'
  [[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || fail \
    'Only Linux x64 and x64 WSL are supported.' 'Solo se admite Linux x64 y WSL x64.'
  command=''
  for command in curl sha256sum mktemp chmod mv cp ln readlink mkdir rmdir rm awk grep; do
    command -v "$command" >/dev/null || fail "Required command: $command" "Comando requerido: $command"
  done
  [[ ${HOME:-} == /* && -d $HOME ]] || fail 'HOME must be an existing absolute directory.' 'HOME debe ser un directorio absoluto existente.'
  bin="$HOME/.local/bin" marker="$HOME/.local/bin/.oec-install-sh.sha256"
  base=https://github.com/2jmalvarez/openeditorcode/releases asset=oec-linux-x64
  tmp='' lock='' replacing=false had_install=false
  cleanup() {
    local status=$?
    trap - EXIT
    trap '' INT TERM
    if [[ $replacing == true ]]; then
      if [[ $had_install == true ]]; then
        mv -f -- "$tmp/previous" "$bin/oec"
        mv -f -- "$tmp/previous.sha256" "$marker"
      else
        rm -f -- "$bin/oec" "$bin/openeditorcode" "$marker"
      fi
    fi
    [[ -z $tmp ]] || rm -rf -- "$tmp"
    [[ -z $lock ]] || rmdir -- "$lock"
    if ((status != 0)); then
      say 'Installation did not complete.' 'La instalacion no se completo.' >&2
    fi
    exit "$status"
  }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  mkdir -p -- "$bin"
  if mkdir -- "$bin/.oec-install-sh.lock" 2>/dev/null; then
    lock="$bin/.oec-install-sh.lock"
  else
    fail 'Another installation is running (or a stale install lock exists).' 'Hay otra instalacion en curso (o un bloqueo residual).'
  fi
  tmp=$(mktemp -d "$bin/.oec-install.XXXXXXXX")
  if [[ -e $bin/oec || -L $bin/oec || -e $bin/openeditorcode || -L $bin/openeditorcode || -e $marker || -L $marker ]]; then
    [[ -f $bin/oec && ! -L $bin/oec && -f $marker && ! -L $marker && -L $bin/openeditorcode ]] || \
      fail 'Refusing to replace unrelated commands or symlinks.' 'No se reemplazan comandos o enlaces ajenos.'
    [[ $(readlink -- "$bin/openeditorcode") == oec && $(sha256sum < "$bin/oec") == "$(< "$marker")" ]] || \
      fail 'Existing installation is modified or not owned by this installer.' 'La instalacion existente fue modificada o no pertenece a este instalador.'
    had_install=true
  fi
  download() { curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 "$@"; }
  if [[ -z $version ]]; then
    latest=''
    latest=$(download --output /dev/null --write-out '%{url_effective}' "$base/latest") || \
      fail 'Cannot resolve latest release.' 'No se puede resolver la ultima release.'
    [[ $latest == "$base/tag/v"* ]] || fail 'Unexpected release URL.' 'URL de release inesperada.'
    version=${latest#"$base/tag/v"}
    [[ $version =~ $version_pattern ]] || fail 'Invalid release version.' 'Version de release no valida.'
  fi
  say "Downloading oec $version..." "Descargando oec $version..."
  if ! download --output "$tmp/$asset" "$base/download/v$version/$asset" || \
    ! download --output "$tmp/SHA256SUMS" "$base/download/v$version/SHA256SUMS"; then
    fail 'Release download failed; existing installation unchanged.' 'Fallo la descarga; instalacion existente sin cambios.'
  fi
  expected='' actual='' reported=''
  expected=$(awk -v name="$asset" '$2 == name { print $1 }' "$tmp/SHA256SUMS")
  [[ $expected =~ ^[0-9a-fA-F]{64}$ ]] || fail 'Missing or invalid checksum.' 'Checksum ausente o no valido.'
  actual=$(sha256sum < "$tmp/$asset"); actual=${actual%% *}
  [[ ${expected,,} == "$actual" ]] || fail 'Checksum mismatch; nothing installed.' 'Checksum incorrecto; no se instalo nada.'
  chmod 755 "$tmp/$asset"
  reported=$("$tmp/$asset" --version </dev/null) || fail 'Binary cannot run on this system.' 'El binario no puede ejecutarse en este sistema.'
  [[ $reported == "$version" ]] || fail 'Binary version mismatch.' 'La version del binario no coincide.'
  sha256sum < "$tmp/$asset" > "$tmp/new.sha256"
  if [[ $had_install == true ]]; then
    cp -p -- "$bin/oec" "$tmp/previous"
    cp -p -- "$marker" "$tmp/previous.sha256"
  fi
  replacing=true
  mv -f -- "$tmp/$asset" "$bin/oec"
  mv -f -- "$tmp/new.sha256" "$marker"
  if [[ $had_install == false ]]; then ln -s oec "$bin/openeditorcode"; fi
  replacing=false

  rc='' line='' shell_name=${SHELL:-}
  shell_name=${shell_name##*/}
  needs_path=true
  case ":${PATH:-}:" in *":$bin:"*|*":$bin/:"*) needs_path=false ;; esac
  if [[ $modify_path == true && $needs_path == true ]]; then
    # Expand HOME and PATH when the user's shell reads its config, not now.
    # shellcheck disable=SC2016
    case "$shell_name" in
      bash) rc="$HOME/.bashrc"; line='case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac # openeditorcode installer' ;;
      zsh) rc="${ZDOTDIR:-$HOME}/.zshrc"; line='case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac # openeditorcode installer' ;;
      fish) rc="${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"; line='contains -- "$HOME/.local/bin" $PATH; or set -gx PATH "$HOME/.local/bin" $PATH # openeditorcode installer' ;;
      *) say 'Unknown shell; PATH was not modified.' 'Shell desconocido; no se modifico PATH.' ;;
    esac
    if [[ -n $rc ]]; then
      if [[ -L $rc || ( -e $rc && ! -f $rc ) ]]; then
        say "Skipping unsafe shell config: $rc" "Se omite configuracion de shell insegura: $rc"
      elif ! grep -Fqx -- "$line" "$rc" 2>/dev/null; then
        if ! { mkdir -p -- "${rc%/*}" && printf '\n%s\n' "$line" >> "$rc"; }; then
          say "Could not update PATH in $rc; add ~/.local/bin manually." "No se pudo actualizar PATH en $rc; agregue ~/.local/bin manualmente."
        fi
      fi
    fi
  fi
  say "OpenEditorCode version $version installed." "OpenEditorCode instalado en version $version."
  say 'To run it, enter oec or openeditorcode inside your project folder.' 'Para ejecutarlo, ingrese oec o openeditorcode dentro de la carpeta de su proyecto.'
  if [[ $needs_path == true ]]; then
    say 'Open a new shell, or add ~/.local/bin to PATH. Config and projects were preserved.' 'Abra un nuevo shell o agregue ~/.local/bin a PATH. Configuracion y proyectos conservados.'
  fi
  cleanup
)

main "$@"
