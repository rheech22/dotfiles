# Dotfiles

My Personal dotfiles.

## Setup

### Getting Started

Clone the repository and inspect the complete bootstrap sequence without changing the machine:

```bash
git clone https://github.com/rheech22/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap.sh --dry-run
```

If Homebrew is missing, run the pinned installer path. If Homebrew already exists, select it explicitly when discovery is ambiguous:

```bash
./bootstrap.sh --install-homebrew
# or
./bootstrap.sh --brew /opt/homebrew/bin/brew
```

Bootstrap downloads a pinned revision of Homebrew's official installer and verifies its SHA-256 before execution. The installer may request `sudo` interactively. Bootstrap then uses the selected Homebrew `fnm` when a suitable runtime is unavailable, installs and selects the current Node 24 moving-LTS release, activates pinned Corepack/pnpm, runs `pnpm install --frozen-lockfile`, builds the CLI, and starts Guided setup. The real Homebrew installer is intentionally not exercised by the automated test suite.

Package changes and link changes have separate reviews and confirmations. Re-run the same bootstrap command after interruption or failure; planning derives current state and resumes only outstanding work.

`--yes` approves both mutation reviews and is required for non-interactive changes. It does not bypass blocked plans, safety checks, or lock ownership checks. Add `--all-packages` to install every package profile instead of the defaults.

### Guided Setup

`dots setup` installs the default `core`, `terminal`, `developer`, `yazi`, and `runtime` profiles, links all enabled configuration, then runs a fresh readiness check. Explicit profile names replace those defaults; `--all-packages` selects every profile.

```bash
dots setup
dots setup core terminal
dots setup --all-packages --brew /opt/homebrew/bin/brew
```

Open the TUI with `dots` or `dots ui`; press `s` from Overview for the same Guided setup. During planning or review, `q` cancels and exits. After an approved package installation or link transaction starts, `q` waits for it to settle safely.

Package installation is sequential and has no rollback: completed packages remain after a later failure. Link application is transactional and attempts rollback if a later link fails. Recovery details and retained resources are reported; re-running setup replans from current state.

### Dependencies

The configuration expects:

- Shell: `fzf`, `zsh-vi-mode`, `zsh-syntax-highlighting`, Starship, zoxide, eza
- Git: GitHub CLI, Lazygit, `git-delta`, Hunk
- Yazi: `fd`, ripgrep, `fzf`, zoxide
- Terminal: WezTerm and DankMono Nerd Font
- Automation and AI: Hammerspoon, Herdr, OpenCode
- Development: Node.js, pnpm

Some Yazi previewers require optional tools such as FFmpeg, 7-Zip, jq, Poppler, resvg, ImageMagick, ExifTool, mpv, and MediaInfo.

### Dots CLI

The TypeScript-based `dots` CLI provides a visual dashboard and safe workflows for links, package profiles, and environment readiness.

The dashboard has three workspaces:

- Overview - readiness, link, CLI requirement, and Node summaries
- Links - actionable links are selected automatically with a live consequence preview
- Packages - Homebrew profile multi-selection with package drill-down

Keyboard controls:

```text
1/2/3       Switch workspaces
s           Guided setup from Overview
j/k         Move
Space       Toggle selection
Enter       Review exact changes
d           Toggle Homebrew preview details
y           Confirm a reviewed change
Esc         Close or go back
r           Refresh
?           Help
q           Quit safely
```

Use the canonical CLI commands for scripts or detailed inspection:

```bash
dots status
dots check --strict

dots links list
dots links status --all
dots links plan zshrc hunk
dots links apply zshrc hunk
dots links lock
dots links unlock

dots packages profiles
dots packages status terminal developer
dots packages plan terminal developer
dots packages apply terminal developer
dots setup core terminal
```

`links apply` computes and displays the exact plan in the same process before confirmation. Existing files and incorrect links are moved to timestamped backup paths. Apply validates the reviewed filesystem state, uses an exclusive per-home lock, and rolls back completed changes if a later item fails. Non-interactive mutation requires `--yes`.

Use `dots links lock` to inspect `~/.dots-apply.lock`. `dots links unlock` removes only a proven stale lock. Unknown or legacy ownership requires explicit `dots links unlock --force`; an active lock is never removed, even with `--force`.

Run `dots --help` or `dots <command> --help` for command-specific options and exit semantics. The old `doctor`, `plan`, `link`, `deps`, and `tui` commands remain as deprecated aliases during migration.

`source-dots.sh` remains as an executable compatibility wrapper that forwards arguments to `bin/dots`. Do not source it into the current shell.

### Dependency Profiles

Homebrew dependencies are grouped into `core`, `terminal`, `developer`, `yazi`, `yazi-preview`, `ai`, `macos`, and `runtime` profiles.

```bash
dots packages status core terminal --brew /opt/homebrew/bin/brew
dots packages plan developer yazi --brew /opt/homebrew/bin/brew
dots packages apply developer yazi --brew /opt/homebrew/bin/brew
```

Use `--all` instead of profile names to select every profile in package commands. If both Apple Silicon and Intel Homebrew installations exist, pass `--brew` or set `DOTS_BREW` in `~/.config/zsh/.zshenv.local`; startup and setup fail closed rather than guessing. Dots prints the persistence command but never edits the local file.

Package status distinguishes resources managed by the selected Homebrew from commands or applications available externally. An external resource is usable, but an exact package plan may still offer to install it under the selected Homebrew for reproducible ownership.

Dependency plans include Homebrew's expanded `--dry-run` preview. Installation disables Homebrew auto-update, implicit target upgrades, cleanup, installed-dependent checks, and secondary prompts. Homebrew may still require transitive dependency installs or upgrades; these are shown in the reviewed preview before confirmation. Dots never invokes uninstall, upgrade, cleanup, or rollback commands directly. A failed package stops the remaining installation and preserves already completed installs.

### Machine-Specific files

Machine-local files are owned by the machine. Dots does not generate, read for planning, modify, back up, or link them.

Create Zsh overrides under `~/.config/zsh/`:

- `.zprofile.local` - Machine-specific PATH configurations (e.g., Homebrew)
- `.zshenv.local` - Machine-specific environment variables (e.g., API keys)
- `.zshrc.local` - Machine-specific aliases and functions

Use the repository's [`.local.example`](.config/zsh/.local.example) only as a template.

Create Git identity and overrides at `~/.gitconfig.local`; use [`.config/git/.local.example`](.config/git/.local.example) as a template. This file is also not generated or modified.

### Development

Bootstrap is the canonical first-run path. For development after the pinned runtime and pnpm are available:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

`.node-version` contains major-only `24` intentionally. It tracks the latest Node 24 moving-LTS release rather than pinning a patch release.

## Versions

- Bob `4.1.3`
- Neovim `nightly`
- Zsh `5.9`
- Starship `1.21.1`
- Homebrew `4.67`
- fzf `0.65.1`
- zsh-vi-mode `0.12.0`
- zsh-syntax-highlighting `0.7.1`
- Git `2.45.2`
- git-delta `0.18.2`
- GitHub CLI `2.66.1`
- Lazygit `0.55.1`
- Hunk `0.17.7`
- Herdr `0.7.5`
- Wezterm `20251014-193657-64f2907c`
- pngpaste `0.2.3`
- Node.js `24` moving LTS
- pnpm `10.19.0`
- Flutter `>=3.31`
- Typescript `5.9.3`
- prettierd `0.25.2`
- stylua `2.3.0`
- fnm `1.38.1`
- tree-sitter-cli `0.25.10`
- ripgrep `15.0.0`
- fd `8.7.1`
- vscode-langservers-extracted `4.10.0`
- yazi `2.5.31`
- rustc `1.94.0-nightly`
- eslintd `14.3.0`
- opencode `latest`
- zoxide `0.9.9`
- eza `0.23.4`
