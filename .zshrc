# colortheme
eval "$(starship init zsh)"

# auto completion
autoload -U compinit; compinit

# nvim
export PATH=$HOME/.local/share/bob/nvim-bin:$PATH
export EDITOR="nvim"

# node version manager
# TODO: change to fnm
lazy_load_nvm() {
  unset -f npm node nvm
  export NVM_DIR=~/.nvm
  [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && source "$NVM_DIR/bash_completion"
}
npm() {
  lazy_load_nvm
  npm $@
}
node() {
  lazy_load_nvm
  node $@
}
nvm() {
  lazy_load_nvm
  nvm $@
}

# soruce
source $(brew --prefix)/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh
source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
source $HOME/.local/bin/env

# flutter 
export PATH="$HOME/flutter/bin:$PATH"
export PATH=~/Library/Android/sdk/tools:$PATH
export PATH=~/Library/Android/sdk/platform-tools:$PATH

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# ripgrep
export RIPGREP_CONFIG_PATH="$HOME/.config/ripgrep/.ripgreprc"

# alias
alias vim=nvim
alias git="LANG=en_GB.UTF-8 git"
alias git:sw="gh auth switch && gh auth setup-git"
alias ll="ls -al --color"
alias lg="lazygit"

# Check if .zshrc.local exists and source it
DOTFILES_PATH="$HOME/dotfiles"
if [ -f "$DOTFILES_PATH/.zshrc.local" ]; then
  source "$DOTFILES_PATH/.zshrc.local"
fi

