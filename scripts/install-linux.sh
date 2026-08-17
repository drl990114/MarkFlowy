#!/usr/bin/env sh
set -eu

APP_NAME="MarkFlowy"
PACKAGE_NAME="mark-flowy"
RELEASE_BASE_URL="https://github.com/drl990114/MarkFlowy/releases"
DEFAULT_MANIFEST_URL="$RELEASE_BASE_URL/latest/download/install.json"
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

By default the script detects your distribution and installs the native
package (.deb on Debian/Ubuntu, .rpm on Fedora/RHEL/openSUSE). On any other
distribution it falls back to the AppImage.

Usage:
  sh install-linux.sh              Detect the distribution and install
  sh install-linux.sh --appimage   Always install the AppImage
  sh install-linux.sh --uninstall  Remove MarkFlowy

Environment:
  MARKFLOWY_MANIFEST_URL   Override updater manifest URL.
  MARKFLOWY_DOWNLOAD_URL   Override download URL (.deb, .rpm or AppImage).
  MARKFLOWY_INSTALL_DIR    Override AppImage install directory.
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
      die "$APP_NAME does not publish Linux aarch64 builds yet"
      ;;
    *)
      die "unsupported Linux architecture: $machine"
      ;;
  esac
}

# Print `deb`, `rpm` or `appimage` based on /etc/os-release. ID is checked
# before ID_LIKE so a derivative that declares both wins on its own family.
detect_package_format() {
  distro_ids=""

  if [ -r /etc/os-release ]; then
    distro_ids=$(
      # shellcheck disable=SC1091
      . /etc/os-release 2>/dev/null || true
      printf '%s %s' "${ID:-}" "${ID_LIKE:-}"
    )
  fi

  for distro_id in $distro_ids; do
    case "$distro_id" in
      debian | ubuntu | linuxmint | pop | elementary | zorin | kali | deepin | raspbian | neon | devuan | trisquel)
        printf '%s\n' "deb"
        return
        ;;
      fedora | rhel | centos | rocky | almalinux | ol | oracle | amzn | scientific | mageia | openmandriva | suse | opensuse | opensuse-leap | opensuse-tumbleweed | sled | sles)
        printf '%s\n' "rpm"
        return
        ;;
    esac
  done

  printf '%s\n' "appimage"
}

# Print the command prefix needed to gain root, or nothing when already root.
# Returns non-zero when privileges cannot be obtained at all.
detect_privilege_command() {
  if [ "$(id -u 2>/dev/null || echo 1)" = "0" ]; then
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    printf '%s\n' "sudo"
    return 0
  fi

  if command -v doas >/dev/null 2>&1; then
    printf '%s\n' "doas"
    return 0
  fi

  return 1
}

package_manager_available() {
  case "$1" in
    deb)
      command -v dpkg >/dev/null 2>&1
      ;;
    rpm)
      command -v dnf >/dev/null 2>&1 ||
        command -v zypper >/dev/null 2>&1 ||
        command -v yum >/dev/null 2>&1 ||
        command -v rpm >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

install_deb() {
  file=$1

  if command -v apt-get >/dev/null 2>&1; then
    if $privilege_command apt-get install -y "$file"; then
      return 0
    fi

    err "apt-get failed, retrying with dpkg"
  fi

  if $privilege_command dpkg -i "$file"; then
    return 0
  fi

  if command -v apt-get >/dev/null 2>&1; then
    say "Resolving missing dependencies..."

    if $privilege_command apt-get install -f -y; then
      return 0
    fi
  fi

  return 1
}

install_rpm() {
  file=$1

  if command -v dnf >/dev/null 2>&1; then
    $privilege_command dnf install -y "$file"
  elif command -v zypper >/dev/null 2>&1; then
    $privilege_command zypper --non-interactive install --allow-unsigned-rpm "$file"
  elif command -v yum >/dev/null 2>&1; then
    $privilege_command yum install -y "$file"
  else
    $privilege_command rpm -Uvh "$file"
  fi
}

# Print dpkg's state word for the package, e.g. `installed`, `unpacked`,
# `half-configured`, `config-files` or `not-installed`. Returns non-zero when
# dpkg cannot be queried at all.
deb_package_state() {
  command -v dpkg-query >/dev/null 2>&1 || return 1

  # `Status` is three words -- want, error flag and state -- so the state is
  # everything after the last space.
  deb_status=$(dpkg-query -W -f='${Status}' "$PACKAGE_NAME" 2>/dev/null || true)

  [ -n "$deb_status" ] || return 1

  printf '%s\n' "${deb_status##* }"
}

# True when the package is fully unpacked *and* configured. A package manager
# can report success while leaving the package in some other state, so this is
# what an install is verified against.
package_installed() {
  case "$1" in
    deb)
      [ "$(deb_package_state || true)" = "installed" ]
      ;;
    rpm)
      command -v rpm >/dev/null 2>&1 && rpm -q "$PACKAGE_NAME" >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

# True when dpkg/rpm knows about the package in any state at all, including a
# half-installed one left behind by a failed install. Uninstall uses this, so
# that a broken package still gets cleaned up.
package_present() {
  case "$1" in
    deb)
      deb_state=$(deb_package_state) || return 1
      [ -n "$deb_state" ] && [ "$deb_state" != "not-installed" ]
      ;;
    rpm)
      package_installed rpm
      ;;
    *)
      return 1
      ;;
  esac
}

# True when the package tooling is present, so a negative package_installed
# result actually means something.
package_state_is_knowable() {
  case "$1" in
    deb) command -v dpkg-query >/dev/null 2>&1 ;;
    rpm) command -v rpm >/dev/null 2>&1 ;;
    *) return 1 ;;
  esac
}

# Remove an AppImage installed by an earlier run of this script. Returns
# non-zero when there was nothing to remove.
remove_appimage() {
  [ -e "$APPIMAGE_PATH" ] || [ -e "$BIN_PATH" ] || return 1

  rm -f "$BIN_PATH" "$APPIMAGE_PATH" "$APPIMAGE_PATH.sig"
  rmdir "$INSTALL_DIR" 2>/dev/null || true
}

remove_package() {
  case "$1" in
    deb)
      if command -v apt-get >/dev/null 2>&1; then
        $privilege_command apt-get remove -y "$PACKAGE_NAME"
      else
        $privilege_command dpkg -r "$PACKAGE_NAME"
      fi
      ;;
    rpm)
      if command -v dnf >/dev/null 2>&1; then
        $privilege_command dnf remove -y "$PACKAGE_NAME"
      elif command -v zypper >/dev/null 2>&1; then
        $privilege_command zypper --non-interactive remove "$PACKAGE_NAME"
      elif command -v yum >/dev/null 2>&1; then
        $privilege_command yum remove -y "$PACKAGE_NAME"
      else
        $privilege_command rpm -e "$PACKAGE_NAME"
      fi
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
  removed=0
  failed=0

  for package_format in deb rpm; do
    if package_present "$package_format"; then
      if privilege_command=$(detect_privilege_command); then
        say "Removing the $package_format package $PACKAGE_NAME..."

        if remove_package "$package_format"; then
          removed=1
        else
          err "failed to remove the $package_format package $PACKAGE_NAME"
          failed=1
        fi
      else
        err "root privileges are required to remove the $package_format package $PACKAGE_NAME"
        failed=1
      fi
    fi
  done

  if remove_appimage; then
    say "Removed the AppImage from $INSTALL_DIR"
    say "Removed command wrapper: $BIN_PATH"
    removed=1
  fi

  if [ "$failed" = "1" ]; then
    return 1
  fi

  [ "$removed" = "1" ] || say "No $APP_NAME installation found."
}

install_appimage() {
  url=$1
  appimage_tmp="$tmp_dir/MarkFlowy.AppImage"

  say "Downloading the $APP_NAME AppImage ${version:-latest}..."
  download "$url" "$appimage_tmp"
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
}

install_package() {
  format=$1
  url=$2
  package_tmp="$tmp_dir/markflowy.$format"

  say "Downloading the $APP_NAME .$format package ${version:-latest}..."

  if ! download "$url" "$package_tmp"; then
    err "failed to download $url"
    return 1
  fi

  say "Installing $package_tmp..."

  case "$format" in
    deb) install_deb "$package_tmp" ;;
    rpm) install_rpm "$package_tmp" ;;
  esac || return 1

  # A package manager can exit 0 without the package ending up installed --
  # `apt-get install -f` in particular is allowed to resolve a broken state by
  # dropping the package it could not configure.
  if package_state_is_knowable "$format" && ! package_installed "$format"; then
    err "the package manager reported success but $PACKAGE_NAME is not installed"
    return 1
  fi

  # An earlier run of this script may have left an AppImage behind, and its
  # ~/.local/bin wrapper would shadow the command from the package.
  if remove_appimage; then
    say "Removed the AppImage left by an earlier run of this script."
  fi

  say ""
  say "$APP_NAME ${version:-latest} installed."
  say "Run: markflowy"
}

format=""
action="install"

while [ $# -gt 0 ]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --appimage)
      format="appimage"
      ;;
    --uninstall)
      action="uninstall"
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
  shift
done

[ -n "${HOME:-}" ] || die "HOME is not set"

privilege_command=""

if [ "$action" = "uninstall" ]; then
  uninstall || exit 1
  exit 0
fi

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/markflowy.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

platform=$(detect_platform)
version=""
manifest_url=""
appimage_url=""

if [ -n "${MARKFLOWY_DOWNLOAD_URL:-}" ]; then
  if [ -z "$format" ]; then
    case "$MARKFLOWY_DOWNLOAD_URL" in
      *.deb) format="deb" ;;
      *.rpm) format="rpm" ;;
      *) format="appimage" ;;
    esac
  fi

  deb_url=$MARKFLOWY_DOWNLOAD_URL
  rpm_url=$MARKFLOWY_DOWNLOAD_URL

  # Only an override that is actually an AppImage may be used as one. Reusing a
  # .deb/.rpm override here would install the package file as `MarkFlowy.AppImage`
  # when the package install fails.
  if [ "$format" = "appimage" ]; then
    appimage_url=$MARKFLOWY_DOWNLOAD_URL
  fi
else
  manifest_path="$tmp_dir/install.json"

  download_manifest "$manifest_path"

  version=$(extract_version "$manifest_path")
  appimage_url=$(extract_platform_url "$manifest_path" "$platform")

  [ -n "$version" ] || die "no version found in $manifest_url"

  # Release assets are named MarkFlowy_v0.0.0_amd64.deb and
  # MarkFlowy-0.0.0-1.x86_64.rpm, so both spellings of the version are needed.
  version_tag=$version
  case "$version_tag" in
    v*) ;;
    *) version_tag="v$version_tag" ;;
  esac
  version_number=${version_tag#v}

  deb_url="$RELEASE_BASE_URL/download/$version_tag/${APP_NAME}_${version_tag}_amd64.deb"
  rpm_url="$RELEASE_BASE_URL/download/$version_tag/${APP_NAME}-${version_number}-1.x86_64.rpm"
fi

if [ -z "$format" ]; then
  format=$(detect_package_format)

  if [ "$format" = "appimage" ]; then
    say "Unrecognized distribution, using the AppImage."
  elif ! package_manager_available "$format"; then
    say "No .$format package manager found, using the AppImage."
    format="appimage"
  elif ! privilege_command=$(detect_privilege_command); then
    say "Installing a .$format package needs root and neither sudo nor doas is available, using the AppImage."
    format="appimage"
  else
    say "Detected a .$format based distribution."
  fi
fi

if [ "$format" != "appimage" ] && [ -z "$privilege_command" ]; then
  privilege_command=$(detect_privilege_command) ||
    die "root privileges are required to install a .$format package, or run with --appimage"
fi

package_url=""

case "$format" in
  deb) package_url=$deb_url ;;
  rpm) package_url=$rpm_url ;;
esac

if [ -n "$package_url" ]; then
  if ! install_package "$format" "$package_url"; then
    [ -n "$appimage_url" ] ||
      die "the .$format install failed and there is no AppImage to fall back to"

    err "the .$format install failed, falling back to the AppImage"
    format="appimage"
  fi
fi

if [ "$format" = "appimage" ]; then
  [ -n "$appimage_url" ] || die "no AppImage URL found for platform '$platform' in ${manifest_url:-MARKFLOWY_DOWNLOAD_URL}"
  install_appimage "$appimage_url"
fi
