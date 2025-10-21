# Dotfiles

My Personal dotfiles.

## Setup

### Zsh Configuration

The zsh configuration files are located in `.config/zsh/`. To use them, create symbolic links:

```bash
# Link the entire zsh config folder
ln -sf ~/dotfiles/.config/zsh ~/.config/zsh

# Link config files to home directory
ln -sf ~/.config/zsh/.zshrc ~/.zshrc
ln -sf ~/.config/zsh/.zshenv ~/.zshenv
ln -sf ~/.config/zsh/.zprofile ~/.zprofile
```

The `.local` files are for machine-specific configurations:
- `.zprofile.local` - Machine-specific PATH configurations (e.g., Homebrew)
- `.zshenv.local` - Machine-specific environment variables (e.g., API keys)
- `.zshrc.local` - Machine-specific aliases and functions

See [`.local.example`](.config/zsh/.local.example) for detailed examples and templates.

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
