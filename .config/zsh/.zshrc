# colortheme
eval "$(starship init zsh)"

# auto completion
autoload -U compinit; compinit

# node version manager
eval "$(fnm env --use-on-cd --shell zsh)"

# plugins
source $(brew --prefix)/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh
source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# alias
alias v='nvim .'
alias vim=nvim
alias git="LANG=en_GB.UTF-8 git"
alias git:sw="gh auth switch && gh auth setup-git"
alias ll="ls -al --color"
alias lg="lazygit"
alias ca="claude"
alias dot="cd $HOME/dotfiles"

# Check if .zshrc.local exists and source it
if [ -f "$HOME/.config/zsh/.zshrc.local" ]; then
  source "$HOME/.config/zsh/.zshrc.local"
fi

