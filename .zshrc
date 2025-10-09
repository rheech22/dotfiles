# colortheme
eval "$(starship init zsh)"

# auto completion
autoload -U compinit; compinit

# soruce
source $(brew --prefix)/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh
source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# Check if .zshrc.local exists and source it
if [ -f "$HOME/.zshrc.local" ]; then
  source "$HOME/.zshrc.local"
fi

# nvim
export PATH=$HOME/.local/share/bob/nvim-bin:$PATH
export EDITOR="nvim"

# node version manager
export NVM_DIR="$HOME/.nvm"
. "$(brew --prefix nvm)/nvm.sh"

# flutter 
export PATH="$HOME/flutter/bin:$PATH"
export LIBRARY_PATH=$LIBRARY_PATH:/opt/homebrew/opt/openssl/lib
export PATH=~/Library/Android/sdk/tools:$PATH
export PATH=~/Library/Android/sdk/platform-tools:$PATH

# alias
alias git="LANG=en_GB.UTF-8 git"
alias ll="ls | lolcat -F 1 -p 88"
alias lla="ls -al | lolcat -F 1 -p 88"
alias lg="lazygit"
alias vim="nvim"
