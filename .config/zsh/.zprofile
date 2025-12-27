# brew
eval "$(/opt/homebrew/bin/brew shellenv)"

# bob
export PATH="$PATH:/Users/demian/.local/bin"

# nvim
export PATH=$HOME/.local/share/bob/nvim-bin:$PATH

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# Check if .zprofile.local exists and source it
if [ -f "$HOME/.config/zsh/.zprofile.local" ]; then
  source "$HOME/.config/zsh/.zprofile.local"
fi
