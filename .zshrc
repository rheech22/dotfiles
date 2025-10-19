# colortheme
eval "$(starship init zsh)"

# auto completion
autoload -U compinit; compinit

# nvim
export PATH=$HOME/.local/share/bob/nvim-bin:$PATH
export EDITOR="nvim"

# node version manager
export NVM_DIR="$HOME/.nvm"
[ -s "$(brew --prefix nvm)/nvm.sh" ] && \. "$(brew --prefix nvm)/nvm.sh" --no-use

NVM_DEFAULT_ALIAS_PATH="$NVM_DIR/alias/default"
if [ -f "$NVM_DEFAULT_ALIAS_PATH" ]; then
  NVM_DEFAULT_VERSION=$(cat "$NVM_DEFAULT_ALIAS_PATH")
  NVM_NODE_PATH="$NVM_DIR/versions/node/v$NVM_DEFAULT_VERSION/bin"
  if [ -d "$NVM_NODE_PATH" ]; then
    export PATH="$NVM_NODE_PATH:$PATH"
  fi
fi

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

