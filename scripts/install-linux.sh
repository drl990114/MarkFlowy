#!/usr/bin/env sh
set -eu

APP_NAME="MarkFlowy"
DEFAULT_MANIFEST_URL="https://github.com/drl990114/MarkFlowy/releases/latest/download/install.json"
FALLBACK_MANIFEST_URL="https://drl990114.github.io/MarkFlowy/install.json"

INSTALL_DIR="${MARKFLOWY_INSTALL_DIR:-${HOME:-}/.local/share/markflowy}"
BIN_DIR="${MARKFLOWY_BIN_DIR:-${HOME:-}/.local/bin}"
APPIMAGE_PATH="$INSTALL_DIR/MarkFlowy.AppImage"
BIN_PATH="$BIN_DIR/markflowy"

say() {
  printf '%s\n' "$*"
}

err() {
  printf 'markflowy-install: %s\n' "$*" >&2
}

die() {
  err "$*"
  exit 1
}

usage() {
  cat <<'EOF'
Install MarkFlowy for Linux.

Usage:
  sh install-linux.sh
  sh install-linux.sh --uninstall

Environment:
  MARKFLOWY_MANIFEST_URL   Override updater manifest URL.
  MARKFLOWY_DOWNLOAD_URL   Override AppImage download URL.
  MARKFLOWY_INSTALL_DIR    Override app install directory.
  MARKFLOWY_BIN_DIR        Override command install directory.
EOF
}

download() {
  url=$1
  output=$2

  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --connect-timeout 20 "$url" -o "$output"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$output" "$url"
  else
    die "curl or wget is required"
  fi
}

download_manifest() {
  output=$1

  if [ -n "${MARKFLOWY_MANIFEST_URL:-}" ]; then
    say "Fetching release manifest from $MARKFLOWY_MANIFEST_URL..."
    download "$MARKFLOWY_MANIFEST_URL" "$output"
    manifest_url=$MARKFLOWY_MANIFEST_URL
    return
  fi

  for url in "$DEFAULT_MANIFEST_URL" "$FALLBACK_MANIFEST_URL"; do
    say "Fetching release manifest from $url..."

    if download "$url" "$output"; then
      manifest_url=$url
      return
    fi

    err "failed to fetch release manifest from $url"
  done

  die "failed to fetch release manifest"
}

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

extract_platform_url() {
  manifest=$1
  platform=$2

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$manifest" "$platform" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as manifest_file:
    data = json.load(manifest_file)

print(data.get("platforms", {}).get(sys.argv[2], {}).get("url", ""))
PY
    return
  fi

  if command -v node >/dev/null 2>&1; then
    node - "$manifest" "$platform" <<'JS'
const fs = require('fs')
const manifest = process.argv[2]
const platform = process.argv[3]
const data = JSON.parse(fs.readFileSync(manifest, 'utf8'))
process.stdout.write(data.platforms?.[platform]?.url || '')
JS
    return
  fi

  tr '\n' ' ' < "$manifest" |
    sed -n "s/.*\"$platform\"[[:space:]]*:[[:space:]]*{[^}]*\"url\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

extract_version() {
  manifest=$1

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$manifest" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as manifest_file:
    data = json.load(manifest_file)

print(data.get("version", ""))
PY
    return
  fi

  if command -v node >/dev/null 2>&1; then
    node - "$manifest" <<'JS'
const fs = require('fs')
const manifest = process.argv[2]
const data = JSON.parse(fs.readFileSync(manifest, 'utf8'))
process.stdout.write(data.version || '')
JS
    return
  fi

  tr '\n' ' ' < "$manifest" |
    sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

detect_platform() {
  os=$(uname -s 2>/dev/null || true)
  machine=$(uname -m 2>/dev/null || true)

  [ "$os" = "Linux" ] || die "$APP_NAME Linux installer can only run on Linux"

  case "$machine" in
    x86_64 | amd64)
      printf '%s\n' "linux"
      ;;
    aarch64 | arm64)
      printf '%s\n' "linux-aarch64"
      ;;
    *)
      die "unsupported Linux architecture: $machine"
      ;;
  esac
}

path_contains_bin_dir() {
  case ":$PATH:" in
    *":$BIN_DIR:"*) return 0 ;;
    *) return 1 ;;
  esac
}

uninstall() {
  rm -f "$BIN_PATH" "$APPIMAGE_PATH" "$APPIMAGE_PATH.sig"
  rmdir "$INSTALL_DIR" 2>/dev/null || true
  say "Removed $APP_NAME from $INSTALL_DIR"
  say "Removed command wrapper: $BIN_PATH"
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
  --uninstall)
    [ -n "${HOME:-}" ] || die "HOME is not set"
    uninstall
    exit 0
    ;;
  "")
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

[ -n "${HOME:-}" ] || die "HOME is not set"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/markflowy.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

platform=$(detect_platform)
version=""
manifest_url=""

if [ -n "${MARKFLOWY_DOWNLOAD_URL:-}" ]; then
  download_url=$MARKFLOWY_DOWNLOAD_URL
else
  manifest_path="$tmp_dir/install.json"

  download_manifest "$manifest_path"

  version=$(extract_version "$manifest_path")
  download_url=$(extract_platform_url "$manifest_path" "$platform")

  if [ -z "$download_url" ]; then
    die "no AppImage URL found for platform '$platform' in $manifest_url"
  fi
fi

appimage_tmp="$tmp_dir/MarkFlowy.AppImage"

say "Downloading $APP_NAME ${version:-latest}..."
download "$download_url" "$appimage_tmp"
chmod 0755 "$appimage_tmp"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
mv -f "$appimage_tmp" "$APPIMAGE_PATH"

quoted_appimage=$(shell_quote "$APPIMAGE_PATH")
{
  printf '%s\n' '#!/usr/bin/env sh'
  printf 'exec %s "$@"\n' "$quoted_appimage"
} > "$BIN_PATH"
chmod 0755 "$BIN_PATH"

say ""
say "$APP_NAME ${version:-latest} installed."
say "AppImage: $APPIMAGE_PATH"
say "Command:  $BIN_PATH"

if ! path_contains_bin_dir; then
  say ""
  say "Add this directory to PATH before running markflowy:"
  say "  export PATH=\"$BIN_DIR:\$PATH\""
else
  say ""
  say "Run: markflowy"
fi

say ""
say "If the AppImage cannot start, install FUSE for your distribution and try again."
