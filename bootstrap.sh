#!/bin/sh

set -eu
set -f

name=bootstrap.sh
script=$0
seen=
hops=0
while [ -L "$script" ]; do
  hops=$((hops + 1))
  if [ "$hops" -gt 40 ]; then
    printf '%s\n' "$name: symlink resolution exceeded 40 hops" >&2
    exit 1
  fi
  case "|$seen|" in
    *"|$script|"*) printf '%s\n' "$name: symlink cycle detected" >&2; exit 1 ;;
  esac
  seen=${seen:+$seen|}$script
  target=$(readlink "$script")
  case "$target" in
    /*) script=$target ;;
    *) script=$(dirname -- "$script")/$target ;;
  esac
done
if [ ! -e "$script" ]; then
  printf '%s\n' "$name: symlink target does not exist" >&2
  exit 1
fi
repo=$(CDPATH= cd -- "$(dirname -- "$script")" && pwd -P)
home_lexical=${HOME:-}
[ "$home_lexical" = / ] || home_lexical=${home_lexical%/}
home_physical=
if [ -n "$home_lexical" ] && [ -d "$home_lexical" ]; then
  home_physical=$(CDPATH= cd -- "$home_lexical" && pwd -P)
fi

usage() {
  printf '%s\n' "Usage: ./bootstrap.sh [--dry-run] [--yes] [--install-homebrew] [--brew ABSOLUTE_PATH] [--all-packages|PROFILE...]"
}

rerun_args=
has_control() {
  sanitized=$(printf '%s' "$1" | LC_ALL=C tr -d '\001-\037\177')
  [ "$sanitized" != "$1" ]
}

safe_display() {
  printf '%s' "$1" | LC_ALL=C tr '\001-\037\177' '?'
}

quote_arg() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

display_path() {
  value=$1
  display_value=$value
  if [ -n "$home_physical" ] && [ "$home_physical" != / ]; then
    case "$value" in
      "$home_physical") display_value='~' ;;
      "$home_physical"/*) display_value="~/${value#"$home_physical"/}" ;;
    esac
  fi
  if [ "$display_value" = "$value" ] && [ -n "$home_lexical" ] && [ "$home_lexical" != / ]; then
    case "$value" in
      "$home_lexical") display_value='~' ;;
      "$home_lexical"/*) display_value="~/${value#"$home_lexical"/}" ;;
    esac
  fi
  safe_display "$display_value"
}

command_path() {
  value=$1
  if has_control "$value"; then
    printf '%s' '<path-with-control-characters>'
    return
  fi
  if [ -n "$home_physical" ] && [ "$home_physical" != / ]; then
    case "$value" in
      "$home_physical") printf '%s' '"$HOME"'; return ;;
      "$home_physical"/*) printf '%s/' '"$HOME"'; quote_arg "${value#"$home_physical"/}"; return ;;
    esac
  fi
  if [ -n "$home_lexical" ] && [ "$home_lexical" != / ]; then
    case "$value" in
      "$home_lexical") printf '%s' '"$HOME"'; return ;;
      "$home_lexical"/*) printf '%s/' '"$HOME"'; quote_arg "${value#"$home_lexical"/}"; return ;;
    esac
  fi
  quote_arg "$value"
}

rerun() {
  printf '%s\n' "$name: safe rerun: $(command_path "$repo/bootstrap.sh")$rerun_args" >&2
}

die() {
  printf '%s\n' "$name: $1" >&2
  rerun
  exit "${2:-1}"
}

dry_run=false
yes=false
install_homebrew=false
all_packages=false
brew_option=
profiles=
profile_count=0

parse_args() {
  while [ "$#" -gt 0 ]; do
    if has_control "$1"; then
      printf '%s\n' "$name: arguments must not contain control characters" >&2
      exit 2
    fi
    rerun_args="$rerun_args $(command_path "$1")"
    case "$1" in
      --dry-run) dry_run=true ;;
      --yes) yes=true ;;
      --install-homebrew) install_homebrew=true ;;
      --all-packages) all_packages=true ;;
      --brew)
        shift
        [ "$#" -gt 0 ] || die "--brew requires an absolute path" 2
        if has_control "$1"; then
          printf '%s\n' "$name: arguments must not contain control characters" >&2
          exit 2
        fi
        rerun_args="$rerun_args $(command_path "$1")"
        case "$1" in /*) brew_option=$1 ;; *) die "--brew requires an absolute path" 2 ;; esac
        ;;
      --help|-h) usage; exit 0 ;;
      -*) die "unknown option: $1" 2 ;;
      *)
        case "$1" in
          [A-Za-z0-9]* ) case "$1" in *[!A-Za-z0-9._-]*) die "invalid profile: $1" 2 ;; esac ;;
          *) die "invalid profile: $1" 2 ;;
        esac
        profile_count=$((profile_count + 1))
        profiles=${profiles}${profiles:+
}$1
        ;;
    esac
    shift
  done
}
parse_args "$@"
[ "$all_packages" = false ] || [ "$profile_count" -eq 0 ] || die "profiles and --all-packages are mutually exclusive" 2

physical_executable() {
  candidate=$1
  [ -x "$candidate" ] || return 1
  case "$candidate" in /*) ;; *) candidate=$PWD/$candidate ;; esac
  resolved_seen=
  resolved_hops=0
  while [ -L "$candidate" ]; do
    resolved_hops=$((resolved_hops + 1))
    [ "$resolved_hops" -le 40 ] || return 1
    case "|$resolved_seen|" in *"|$candidate|"*) return 1 ;; esac
    resolved_seen=${resolved_seen:+$resolved_seen|}$candidate
    resolved_target=$(readlink "$candidate") || return 1
    case "$resolved_target" in
      /*) candidate=$resolved_target ;;
      *) candidate=$(dirname -- "$candidate")/$resolved_target ;;
    esac
  done
  [ -x "$candidate" ] || return 1
  candidate_dir=$(CDPATH= cd -- "$(dirname -- "$candidate")" && pwd -P) || return 1
  printf '%s/%s\n' "$candidate_dir" "$(basename -- "$candidate")"
}

validate_brew() {
  brew_path=$(physical_executable "$1") || die "Homebrew executable is invalid: $(display_path "$1")"
  [ "$(basename -- "$brew_path")" = brew ] || die "Homebrew executable basename must be brew: $(display_path "$brew_path")"
  printf '%s\n' "$brew_path"
}

append_candidate() {
  canonical=$(physical_executable "$1" 2>/dev/null) || return 0
  [ "$(basename -- "$canonical")" = brew ] || return 0
  case "
$candidates
" in *"
$canonical
"*) return 0 ;; esac
  candidates=${candidates}${candidates:+
}$canonical
  candidate_count=$((candidate_count + 1))
}

discover_brew() {
  candidates=
  candidate_count=0
  append_candidate /opt/homebrew/bin/brew
  append_candidate /usr/local/bin/brew
  path_brew=$(command -v brew 2>/dev/null || true)
  [ -z "$path_brew" ] || append_candidate "$path_brew"
}

choose_brew() {
  discover_brew
  if [ "$candidate_count" -eq 0 ]; then return 1; fi
  if [ "$candidate_count" -eq 1 ]; then printf '%s\n' "$candidates"; return 0; fi
  if ! { [ -t 0 ] && [ -t 2 ]; }; then
    printf '%s\n' "$name: multiple Homebrew installations found; rerun with --brew ABSOLUTE_PATH" >&2
    return 2
  fi
  printf '%s\n' "Select Homebrew:" >&2
  index=1
  old_ifs=$IFS
  IFS='
'
  for candidate in $candidates; do printf '  %s) %s\n' "$index" "$(display_path "$candidate")" >&2; index=$((index + 1)); done
  IFS=$old_ifs
  printf '%s' "Choice: " >&2
  IFS= read -r choice
  index=1
  old_ifs=$IFS
  IFS='
'
  for candidate in $candidates; do
    if [ "$choice" = "$index" ]; then IFS=$old_ifs; printf '%s\n' "$candidate"; return 0; fi
    index=$((index + 1))
  done
  IFS=$old_ifs
  printf '%s\n' "$name: invalid Homebrew selection" >&2
  return 2
}

brew=
if [ -n "$brew_option" ]; then
  brew=$(validate_brew "$brew_option")
elif [ -n "${DOTS_BREW:-}" ]; then
  case "$DOTS_BREW" in /*) ;; *) die "DOTS_BREW must be an absolute path" ;; esac
  brew=$(validate_brew "$DOTS_BREW")
else
  brew_status=0
  brew=$(choose_brew) || brew_status=$?
  [ "$brew_status" -lt 2 ] || die "Homebrew selection failed"
fi

node_supported() {
  version=$1
  case "$version" in v*) version=${version#v} ;; esac
  major=${version%%.*}
  remainder=${version#*.}
  [ "$remainder" != "$version" ] || return 1
  minor=${remainder%%.*}
  patch=${remainder#*.}
  [ "$patch" != "$remainder" ] || return 1
  case "$major:$minor:$patch" in *[!0-9:]*) return 1 ;; esac
  [ "$major" -gt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -ge 19 ]; }
}

verify_brew() {
  "$1" --version >/dev/null 2>&1 || die "Homebrew verification failed: $(display_path "$1") --version"
  verified_prefix=$("$1" --prefix 2>/dev/null) || die "Homebrew verification failed: $(display_path "$1") --prefix"
  case "$verified_prefix" in /*) ;; *) die "Homebrew prefix is not absolute: $(display_path "$verified_prefix")" ;; esac
  [ -d "$verified_prefix" ] || die "Homebrew prefix does not exist: $(display_path "$verified_prefix")"
  printf '%s\n' "$verified_prefix"
}

read_node_target() {
  node_file=$repo/.node-version
  [ -f "$node_file" ] || die ".node-version is missing"
  IFS= read -r node_target < "$node_file" || [ -n "${node_target:-}" ] || die ".node-version is empty"
  # Major-only 24 intentionally tracks the current Node 24 moving-LTS release.
  [ "$node_target" = 24 ] || die ".node-version must contain exactly the moving-LTS major 24"
  [ "$(wc -l < "$node_file" | tr -d ' ')" = 1 ] || die ".node-version must contain exactly one line"
  printf '%s\n' "$node_target"
}

if [ "$dry_run" = true ]; then
  printf '%s\n' "1. Homebrew: $(if [ -n "$brew" ]; then display_path "$brew"; else printf '%s' 'discover or explicitly install Homebrew'; fi)"
  current_node=$(node --version 2>/dev/null || printf '%s' missing)
  printf '%s\n' "2. Node runtime: current $current_node; verify provenance or install/use/default Node $(read_node_target) via selected Homebrew fnm"
  printf '%s\n' "3. pnpm: ensure Corepack and activate pnpm 10.19.0"
  printf '%s\n' "4. Dependencies: corepack pnpm install --frozen-lockfile in $(display_path "$repo")"
  printf '%s\n' "5. Build: corepack pnpm build in $(display_path "$repo")"
  printf '%s\n' "6. Setup: exec $(display_path "$repo/bin/dots") setup with selected profiles, Homebrew, and approval options"
  exit 0
fi

if [ -z "$brew" ]; then
  [ "$install_homebrew" = true ] || die "Homebrew was not found; install it separately or rerun with --install-homebrew"
  unsafe_homebrew_env=
  for unsafe_name in HOMEBREW_CASK_OPTS HOMEBREW_NO_QUARANTINE HOMEBREW_API_DOMAIN HOMEBREW_ARTIFACT_DOMAIN HOMEBREW_BOTTLE_DOMAIN HOMEBREW_BREW_GIT_REMOTE HOMEBREW_CORE_GIT_REMOTE HOMEBREW_NO_INSTALL_FROM_API; do
    eval "unsafe_set=\${$unsafe_name+x}"
    [ -z "$unsafe_set" ] || unsafe_homebrew_env="${unsafe_homebrew_env}${unsafe_homebrew_env:+, }$unsafe_name"
  done
  [ -z "$unsafe_homebrew_env" ] || die "unsafe Homebrew installer environment variables are set: $unsafe_homebrew_env"
  if [ "$yes" = false ]; then
    [ -t 0 ] && [ -t 2 ] || die "--install-homebrew requires --yes outside an interactive terminal"
    printf '%s' "Install Homebrew using the official installer? [y/N] " >&2
    IFS= read -r answer
    case "$answer" in y|Y) ;; *) die "Homebrew installation was not approved" ;; esac
  fi
  installer_commit=39a0c068274254a7658fd9761d59bce9d0e2151f
  installer_sha256=8ff338091a5e10bb5fc040b38316648110f42feff057ecf9feaab51fd0a13ef9
  installer_url=https://raw.githubusercontent.com/Homebrew/install/$installer_commit/install.sh
  installer_file=$(mktemp "${TMPDIR:-/tmp}/dots-homebrew-install.XXXXXX") || die "could not create Homebrew installer temporary file"
  cleanup_installer() { rm -f -- "$installer_file"; }
  trap cleanup_installer 0 1 2 15
  curl -fsSL "$installer_url" -o "$installer_file" || die "Homebrew installer download failed"
  installer_actual=$(shasum -a 256 "$installer_file" | cut -d ' ' -f 1) || die "Homebrew installer checksum could not be computed"
  [ "$installer_actual" = "$installer_sha256" ] || die "Homebrew installer checksum mismatch"
  if [ -t 0 ] && [ -t 2 ]; then
    unset NONINTERACTIVE
    /bin/bash "$installer_file" || die "Homebrew installer failed"
  else
    if [ "$(uname -s)" = Darwin ]; then
      sudo -n true >/dev/null 2>&1 || die "non-interactive Homebrew installation requires passwordless sudo; rerun in a TTY"
    fi
    NONINTERACTIVE=1 /bin/bash "$installer_file" || die "Homebrew installer failed"
  fi
  cleanup_installer
  trap - 0 1 2 15
  brew_status=0
  brew=$(choose_brew) || brew_status=$?
  [ "$brew_status" -eq 0 ] || brew=
  [ -n "$brew" ] || die "Homebrew installer exited successfully, but brew was not discovered"
fi

brew_prefix=$(verify_brew "$brew")
PATH=$brew_prefix/bin:$brew_prefix/sbin:$PATH
export PATH
node_target=$(read_node_target)
node_path=$(command -v node 2>/dev/null || true)
corepack_path=$(command -v corepack 2>/dev/null || true)
node_version=$(node --version 2>/dev/null || true)
runtime_consistent=false
if node_supported "$node_version" && [ -n "$node_path" ] && [ -n "$corepack_path" ]
then
  [ "$(dirname -- "$node_path")" != "$(dirname -- "$corepack_path")" ] || runtime_consistent=true
fi

if [ "$runtime_consistent" = false ]; then
  fnm_versions=$("$brew" list --versions fnm 2>/dev/null || true)
  if [ -z "$fnm_versions" ]; then
    "$brew" install fnm || die "brew install fnm failed"
    fnm_versions=$("$brew" list --versions fnm 2>/dev/null || true)
    [ -n "$fnm_versions" ] || die "Homebrew did not report fnm installed"
  fi
  fnm_prefix=$("$brew" --prefix fnm 2>/dev/null) || die "could not locate Homebrew fnm prefix"
  case "$fnm_prefix" in /*) ;; *) die "Homebrew fnm prefix is not absolute: $(display_path "$fnm_prefix")" ;; esac
  fnm=$fnm_prefix/bin/fnm
  [ -x "$fnm" ] || die "Homebrew fnm is not executable: $(display_path "$fnm")"
  fnm_env=$("$fnm" env --shell bash) || die "fnm env failed"
  eval "$fnm_env" || die "fnm environment activation failed"
  export PATH
  "$fnm" install "$node_target" || die "fnm install $node_target failed"
  "$fnm" use "$node_target" || die "fnm use $node_target failed"
  "$fnm" default "$node_target" || die "fnm default $node_target failed"
fi
node_version=$(node --version 2>/dev/null || true)
node_supported "$node_version" || die "final Node version is unsupported: ${node_version:-missing}"

if ! command -v corepack >/dev/null 2>&1; then
  command -v npm >/dev/null 2>&1 || die "fnm-managed Node does not provide corepack or npm"
  npm install --global corepack@0.35.0 || die "npm install --global corepack@0.35.0 failed"
fi
corepack_path=$(command -v corepack 2>/dev/null || true)
node_path=$(command -v node 2>/dev/null || true)
[ -n "$corepack_path" ] && [ "$(dirname -- "$corepack_path")" = "$(dirname -- "$node_path")" ] || die "Node and Corepack provenance is inconsistent"
"$corepack_path" enable pnpm || die "corepack enable pnpm failed"
"$corepack_path" install --global pnpm@10.19.0 || die "Corepack could not activate pnpm 10.19.0"
[ "$(CDPATH= cd -- "$repo" && "$corepack_path" pnpm --version 2>/dev/null)" = 10.19.0 ] || die "pnpm 10.19.0 verification failed"

(CDPATH= cd -- "$repo" && "$corepack_path" pnpm install --frozen-lockfile) || die "pnpm install --frozen-lockfile failed"
(CDPATH= cd -- "$repo" && "$corepack_path" pnpm build) || die "pnpm build failed"

set -- setup --brew "$brew"
[ "$yes" = false ] || set -- "$@" --yes
if [ "$all_packages" = true ]; then
  set -- "$@" --all-packages
elif [ "$profile_count" -gt 0 ]; then
  old_ifs=$IFS
  IFS='
'
  for profile in $profiles; do set -- "$@" "$profile"; done
  IFS=$old_ifs
fi
if [ "${DOTS_BREW:-}" != "$brew" ]; then
  printf '%s\n' "Persist Homebrew selection in ~/.config/zsh/.zshenv.local:" "export DOTS_BREW=$(command_path "$brew")"
fi
DOTS_BREW=$brew
export DOTS_BREW
exec "$repo/bin/dots" "$@"
