# editor
export EDITOR="nvim"

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
