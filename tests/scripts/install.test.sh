#!/usr/bin/env bash
set -Eeuo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
temp=$(mktemp -d)
trap 'rm -rf -- "$temp"' EXIT
trap 'printf "Installer test failed at line %s\n" "$LINENO" >&2; if [[ -f $temp/output ]]; then cat "$temp/output" >&2; fi' ERR
mkdir -p "$temp/mock"
export REAL_MV
REAL_MV=$(command -v mv)
export PATH="$temp/mock:$PATH"
export MOCK_LOG="$temp/requests" MOCK_PLATFORM=Linux MOCK_ARCH=x86_64 MOCK_VERSION=1.2.3 MOCK_FAILURE=

cat > "$temp/mock/uname" <<'MOCK'
#!/usr/bin/env bash
if [[ $1 == -s ]]; then echo "$MOCK_PLATFORM"; else echo "$MOCK_ARCH"; fi
MOCK
cat > "$temp/mock/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_LOG"
[[ $* == *"--proto =https --proto-redir =https"* ]] || exit 90
out= url=
while (($#)); do
  case "$1" in
    --output) out=$2; shift 2 ;;
    https://*) url=$1; shift ;;
    *) shift ;;
  esac
done
[[ $MOCK_FAILURE != network ]] || exit 22
if [[ $MOCK_FAILURE == signal ]]; then kill -TERM "$PPID"; exit 1; fi
if [[ $MOCK_FAILURE == interrupt ]]; then kill -INT "$PPID"; exit 1; fi
if [[ $url == */latest ]]; then
  printf 'https://github.com/2jmalvarez/openeditorcode/releases/tag/v1.2.3'
elif [[ $url == */SHA256SUMS ]]; then
  if [[ $MOCK_FAILURE == missing ]]; then
    printf '%064d  other-file\n' 0 > "$out"
  elif [[ $MOCK_FAILURE == checksum ]]; then
    printf '%064d  oec-linux-x64\n' 0 > "$out"
  else
    sum=$(sha256sum < "${out%/*}/oec-linux-x64")
    printf '%s  oec-linux-x64\n' "${sum%% *}" > "$out"
    if [[ $MOCK_FAILURE == duplicate ]]; then cat "$out" >> "$out.copy"; cat "$out.copy" >> "$out"; fi
  fi
elif [[ $url == */oec-linux-x64 ]]; then
  printf '#!/usr/bin/env bash\n[[ $1 == --version ]] || exit 1\nprintf "%%s\\n" "%s"\n' "$MOCK_VERSION" > "$out"
else
  exit 91
fi
MOCK
cat > "$temp/mock/mv" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ $MOCK_FAILURE == replace && $* == *'/new.sha256 '* ]]; then exit 1; fi
if [[ $MOCK_FAILURE == replace-signal && $* == *'/new.sha256 '* ]]; then
  kill -TERM "$PPID"
  exit 1
fi
exec "$REAL_MV" "$@"
MOCK
chmod +x "$temp/mock/"*

new_home() {
  export HOME="$temp/$1" SHELL=/bin/bash
  export LC_ALL=C LC_MESSAGES='' LANG=C MOCK_FAILURE='' MOCK_VERSION=1.2.3 MOCK_PLATFORM=Linux MOCK_ARCH=x86_64
  unset ZDOTDIR XDG_CONFIG_HOME
  mkdir -p "$HOME"
}
install() { bash "$root/install.sh" "$@" > "$temp/output" 2>&1; }
reject() {
  if install "$@"; then echo 'Expected installer failure' >&2; exit 1; fi
}
assert_clean() {
  if grep -q 'unbound variable' "$temp/output"; then exit 1; fi
  [[ ! -e $HOME/.local/bin/.oec-install-sh.lock ]]
  local leftovers=("$HOME/.local/bin/".oec-install.*)
  [[ ! -e ${leftovers[0]} ]]
}

new_home 'piped home'
mkdir -p "$HOME/.config/openeditorcode" "$HOME/project"
echo config > "$HOME/.config/openeditorcode/settings.json"
echo project > "$HOME/project/file.txt"
# Exercise a real pipe, as used by curl installations.
# shellcheck disable=SC2002
cat "$root/install.sh" | bash -s -- --no-modify-path > "$temp/output" 2>&1
grep -Fxq 'OpenEditorCode version 1.2.3 installed.' "$temp/output"
grep -Fxq 'To run it, enter oec or openeditorcode inside your project folder.' "$temp/output"
[[ $("$HOME/.local/bin/oec" --version) == 1.2.3 ]]
[[ $("$HOME/.local/bin/openeditorcode" --version) == 1.2.3 ]]
[[ ! -e $HOME/.bashrc ]]
grep -q '/download/v1.2.3/oec-linux-x64' "$MOCK_LOG"
[[ $(< "$HOME/.config/openeditorcode/settings.json") == config ]]
[[ $(< "$HOME/project/file.txt") == project ]]
assert_clean

install --version v1.2.3
install --version 1.2.3
[[ $(grep -c 'openeditorcode installer' "$HOME/.bashrc") == 1 ]]
bash -c 'source "$HOME/.bashrc"; source "$HOME/.bashrc"; [[ $PATH == "$HOME/.local/bin:"* && ${PATH#"$HOME/.local/bin:"} != *"$HOME/.local/bin"* ]]'
export MOCK_VERSION=2.0.0
install --version 2.0.0 --no-modify-path
[[ $("$HOME/.local/bin/oec" --version) == 2.0.0 ]]
for failure in network checksum missing duplicate version signal interrupt; do
  export MOCK_FAILURE=$failure MOCK_VERSION=9.9.9
  reject --version 3.0.0 --no-modify-path
  [[ $("$HOME/.local/bin/oec" --version) == 2.0.0 ]]
  assert_clean
done
for failure in replace replace-signal; do
  export MOCK_FAILURE=$failure MOCK_VERSION=3.0.0
  reject --version 3.0.0 --no-modify-path
  [[ $("$HOME/.local/bin/oec" --version) == 2.0.0 ]]
  [[ $(sha256sum < "$HOME/.local/bin/oec") == "$(< "$HOME/.local/bin/.oec-install-sh.sha256")" ]]
  assert_clean
done
export MOCK_FAILURE=replace MOCK_VERSION=3.0.0
# A separate Bash keeps errexit enabled; the wrapper forces nested scope unwinding.
status=0
bash -c '
  set -euo pipefail
  run_installer() { source "$1" --version 3.0.0 --no-modify-path; }
  run_installer "$1"
' bash "$root/install.sh" > "$temp/output" 2>&1 || status=$?
[[ $status == 1 ]]
grep -Fxq 'Installation did not complete.' "$temp/output"
[[ $("$HOME/.local/bin/oec" --version) == 2.0.0 ]]
[[ $(sha256sum < "$HOME/.local/bin/oec") == "$(< "$HOME/.local/bin/.oec-install-sh.sha256")" ]]
[[ $(readlink -- "$HOME/.local/bin/openeditorcode") == oec ]]
assert_clean
export MOCK_FAILURE='' MOCK_VERSION=2.0.0
install --version 2.0.0 --no-modify-path

new_home initial-rollback
export MOCK_FAILURE=replace
reject --version 1.2.3
[[ ! -e $HOME/.local/bin/oec && ! -L $HOME/.local/bin/openeditorcode && ! -e $HOME/.local/bin/.oec-install-sh.sha256 ]]
assert_clean

new_home invalid-bin
mkdir -p "$HOME/.local"
echo foreign > "$HOME/.local/bin"
reject --version 1.2.3
[[ $(< "$HOME/.local/bin") == foreign ]]
assert_clean

new_home locked
mkdir -p "$HOME/.local/bin/.oec-install-sh.lock"
reject --version 1.2.3
[[ -d $HOME/.local/bin/.oec-install-sh.lock ]]

new_home foreign
mkdir -p "$HOME/.local/bin"
echo foreign > "$HOME/.local/bin/oec"
reject --version 1.2.3
[[ $(< "$HOME/.local/bin/oec") == foreign ]]
assert_clean
rm "$HOME/.local/bin/oec"
echo target > "$HOME/target"
ln -s "$HOME/target" "$HOME/.local/bin/oec"
reject --version 1.2.3
[[ $(< "$HOME/target") == target && -L $HOME/.local/bin/oec ]]
rm "$HOME/.local/bin/oec"
ln -s missing "$HOME/.local/bin/openeditorcode"
reject --version 1.2.3
assert_clean

new_home foreign-alias
mkdir -p "$HOME/.local/bin"
echo foreign > "$HOME/.local/bin/openeditorcode"
reject --version 1.2.3
[[ $(< "$HOME/.local/bin/openeditorcode") == foreign && ! -e $HOME/.local/bin/oec ]]
assert_clean

new_home modified
install --version 1.2.3
echo modified >> "$HOME/.local/bin/oec"
reject --version 1.2.3
grep -q modified "$HOME/.local/bin/oec"
assert_clean

for shell in bash zsh fish; do
  new_home "$shell"
  export SHELL="/bin/$shell"
  case "$shell" in
    bash) rc="$HOME/.bashrc" ;;
    zsh) export ZDOTDIR="$HOME/zsh"; rc="$ZDOTDIR/.zshrc" ;;
    fish) export XDG_CONFIG_HOME="$HOME/config"; rc="$XDG_CONFIG_HOME/fish/config.fish" ;;
  esac
  mkdir -p "${rc%/*}"
  echo '# existing config' > "$rc"
  install --version 1.2.3
  install --version 1.2.3
  [[ $(grep -c 'openeditorcode installer' "$rc") == 1 ]]
  grep -q '# existing config' "$rc"
  assert_clean
done

for shell in bash zsh fish; do
  for suffix in '' /; do
    new_home "path-present-$shell-${suffix:+slash}"
    export SHELL="/bin/$shell"
    PATH="$PATH:$HOME/.local/bin$suffix" install --version 1.2.3
    [[ ! -e $HOME/.bashrc && ! -e $HOME/.zshrc && ! -e $HOME/.config/fish/config.fish ]]
    if grep -q 'Open a new shell' "$temp/output"; then exit 1; fi
    assert_clean
  done
done

new_home spanish-output
export LC_ALL='' LC_MESSAGES='' LANG=es
install --version 1.2.3 --no-modify-path
grep -Fxq 'OpenEditorCode instalado en version 1.2.3.' "$temp/output"
grep -Fxq 'Para ejecutarlo, ingrese oec o openeditorcode dentro de la carpeta de su proyecto.' "$temp/output"
assert_clean

new_home shell-symlink
echo safe > "$HOME/target"
ln -s "$HOME/target" "$HOME/.bashrc"
install --version 1.2.3
[[ $(< "$HOME/target") == safe ]]
new_home no-shell
export SHELL=
install --version 1.2.3
grep -q 'Unknown shell' "$temp/output"

new_home locales
export MOCK_PLATFORM=Darwin LC_ALL=es_ES.UTF-8 LC_MESSAGES=en_US.UTF-8 LANG=en_US.UTF-8
reject
grep -q 'Solo se admite Linux x64 y WSL x64' "$temp/output"
export LC_ALL='' LC_MESSAGES=es_MX.UTF-8
reject
grep -q 'Solo se admite' "$temp/output"
export LC_MESSAGES='' LANG=es_AR.UTF-8
reject
grep -q 'Solo se admite' "$temp/output"
export LC_ALL=C
reject
grep -q 'Only Linux x64' "$temp/output"
export LC_ALL=fr_FR.UTF-8
reject
grep -q 'Only Linux x64' "$temp/output"
export LC_ALL=C MOCK_PLATFORM=Linux MOCK_ARCH=aarch64
reject
grep -q 'Only Linux x64' "$temp/output"
export MOCK_ARCH=x86_64
reject --version '../bad'
reject --version
reject --version ''
reject --unknown
assert_clean
echo 'Installer offline tests passed.'
