# colortheme
eval "$(starship init zsh)"
export LSCOLORS="ExFxBxDxCxegedabagacad"

# auto completion
autoload -U compinit; compinit

# history size
export HISTSIZE=1000000000
export SAVEHIST=$HISTSIZE
setopt EXTENDED_HISTORY

# auto cd
setopt autocd

# search history via Ctrl+R
source <(fzf --zsh)

# node version manager
eval "$(fnm env --use-on-cd --shell zsh)"

# rust
. "$HOME/.cargo/env"

# plugins
source $(brew --prefix)/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh
source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# alias
alias v="nvim"
alias vim="nvim"
alias git="LANG=en_GB.UTF-8 git"
alias gsw="gh auth switch && gh auth setup-git"
alias ll="ls -al --color"
alias lg="lazygit"
alias cc="claude"
alias oo="opencode"
alias dot="cd $HOME/dotfiles"
alias zsh="source ~/.zshrc"

# fnm, TODO: move to local
FNM_PATH="/usr/local/opt/fnm/bin"
if [ -d "$FNM_PATH" ]; then
  eval "`fnm env`"
fi

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

