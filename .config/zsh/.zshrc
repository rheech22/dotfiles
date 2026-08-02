# colortheme
if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi
export LSCOLORS="ExFxBxDxCxegedabagacad"

# zoxide
if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh --cmd cd)"
fi

# Re-render prompt on SIGUSR1 (triggered by theme sync)
TRAPUSR1() {
  zle && zle reset-prompt
}

# auto completion
autoload -U compinit; compinit

# history size
export HISTSIZE=1000000000
export SAVEHIST=$HISTSIZE
setopt EXTENDED_HISTORY

# auto cd
setopt autocd

# search history via Ctrl+R
if command -v fzf >/dev/null 2>&1; then
  source <(fzf --zsh)
fi

# node version manager
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd --shell zsh)"
fi

# rust
if [ -f "$HOME/.cargo/env" ]; then
  . "$HOME/.cargo/env"
fi

# plugins
if command -v brew >/dev/null 2>&1; then
  _dots_brew_prefix=$(brew --prefix 2>/dev/null)
  if [ -n "$_dots_brew_prefix" ]; then
    [ ! -f "$_dots_brew_prefix/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh" ] || source "$_dots_brew_prefix/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh"
    [ ! -f "$_dots_brew_prefix/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ] || source "$_dots_brew_prefix/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
  fi
  unset _dots_brew_prefix
fi

# alias
alias v="nvim"
alias vim="nvim"
alias git="LANG=en_GB.UTF-8 git"
alias gsw="gh auth switch && gh auth setup-git"
alias ll="eza --all --show-symlinks --header --long --grid --color=always --color-scale --color-scale-mode=gradient --icons --hyperlink --time-style='+%y/%m/%d|%H:%M' --no-user --no-filesize"
alias lg="lazygit"
alias cc="claude"
alias oo="opencode"
alias dot="cd $HOME/dotfiles"
alias zsh="source ~/.zshrc"
alias z='__zoxide_z'
alias zi='__zoxide_zi'
alias j='just'
alias gd='hunk diff'

# Check if .zshrc.local exists and source it
if [ -f "$HOME/.config/zsh/.zshrc.local" ]; then
  source "$HOME/.config/zsh/.zshrc.local"
fi

# functions
function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ -n "$cwd" ] && [ "$cwd" != "$PWD" ] && builtin cd -- "$cwd"
	rm -f -- "$tmp"
}

function wt() {
  local dir
  dir=$(git worktree list --porcelain \
    | awk -v pwd="$PWD" '/^worktree / && $2 != pwd {print $2}' \
    | fzf)
	
  if [ -n "$dir" ]; then
    cd "$dir"
  fi
}
