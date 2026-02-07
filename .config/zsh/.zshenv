# editor
export EDITOR="nvim"

# lazygit
export XDG_CONFIG_HOME="$HOME/.config"
export LG_CONFIG_FILE="$HOME/.config/lazygit/config.yml,$HOME/.cache/lazygit-theme.yml"

# claude
export USE_BUILTIN_RIPGREP=0

# ripgrep
export RIPGREP_CONFIG_PATH="$HOME/.config/ripgrep/.ripgreprc"

# Check if .zshenv.local exists and source it
if [ -f "$HOME/.config/zsh/.zshenv.local" ]; then
  source "$HOME/.config/zsh/.zshenv.local"
fi

# cargo
. "$HOME/.cargo/env"
