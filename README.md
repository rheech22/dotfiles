# Dotfiles

My Personal dotfiles.

## Setup

### Getting Started

Clone this repository:

```bash
git clone https://github.com/rheech22/dotfiles.git ~/dotfiles
cd ~/dotfiles
```

### Use Symbolic Link Script

Use the interactive script to manage symbolic links for your dotfiles:

```bash
chmod +x ~/dotfiles/source-dots.sh
./source-dots.sh
```

The script provides an interactive menu (using `fzf` if available) to:

- Check current link status
- Create links selectively (individual items or groups)
- Create all links at once

**Note:** It's recommended to install `fzf` for the best interactive experience. Without `fzf`, the script will fall back to a numbered menu system.

### Machine-Specific files

The `.local` files are for machine-specific configurations that should not be committed to the repository:

**Zsh configurations** (`~/dotfiles/.config/zsh/`):

- `.zprofile.local` - Machine-specific PATH configurations (e.g., Homebrew)
- `.zshenv.local` - Machine-specific environment variables (e.g., API keys)
- `.zshrc.local` - Machine-specific aliases and functions

See [`.local.example`](.config/zsh/.local.example) for detailed examples and templates.

**Git configuration** (`~/dotfiles/.config/git/`):

- `.gitconfig.local` - Machine-specific Git settings (e.g., user name, email, aliases)

See [`.local.example`](.config/git/.local.example) for a template. Copy it to `.gitconfig.local` and customize with your local settings.

## Versions

- Bob `4.1.3`
- Neovim `nightly`
- Zsh `5.9`
- Starship `1.21.1`
- Homebrew `4.67`
- Git `2.45.2`
- GitHub CLI `2.66.1`
- Lazygit `0.55.1`
- Wezterm `20251014-193657-64f2907c`
- pngpaste `0.2.3`
- Node.js `>=22`
- Flutter `>=3.31`
- Typescript `5.9.3`
- prettierd `0.25.2`
- stylua `2.3.0`
- fnm `1.38.1`
- tree-sitter-cli `0.25.10`
- ripgrep `15.0.0`
- vscode-langservers-extracted `4.10.0`
- yazi `2.5.31`
- rustc `1.94.0-nightly`
