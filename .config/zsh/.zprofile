# brew
if [ -n "${DOTS_BREW:-}" ] && [ -x "$DOTS_BREW" ]; then
  _dots_brew=$DOTS_BREW
elif [ -x /opt/homebrew/bin/brew ] && [ -x /usr/local/bin/brew ]; then
  print -u2 "zprofile: multiple Homebrew installations found; set DOTS_BREW in ~/.config/zsh/.zshenv.local"
  _dots_brew=
elif [ -x /opt/homebrew/bin/brew ]; then
  _dots_brew=/opt/homebrew/bin/brew
elif [ -x /usr/local/bin/brew ]; then
  _dots_brew=/usr/local/bin/brew
elif command -v brew >/dev/null 2>&1; then
  _dots_brew=$(command -v brew)
else
  _dots_brew=
fi
if [ -n "$_dots_brew" ]; then
  eval "$("$_dots_brew" shellenv)"
fi
unset _dots_brew

# bob
export PATH="$PATH:$HOME/.local/bin"

# nvim
export PATH=$HOME/.local/share/bob/nvim-bin:$PATH

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# opencode
export PATH=$HOME/.opencode/bin:$PATH

# Check if .zprofile.local exists and source it
if [ -f "$HOME/.config/zsh/.zprofile.local" ]; then
  source "$HOME/.config/zsh/.zprofile.local"
fi
