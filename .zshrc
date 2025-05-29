export PATH=/opt/homebrew/bin:$PATH

# colortheme
eval "$(starship init zsh)"

# auto completion
# TODO: read this article https://thevaluable.dev/zsh-completion-guide-examples/
autoload -U compinit; compinit

# nvim
export EDITOR="/usr/local/bin/nvim"

# soruce
source $(brew --prefix)/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh
source $(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# Check if .zshrc.local exists and source it
if [ -f "$HOME/.zshrc.local" ]; then
  source "$HOME/.zshrc.local"
fi

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
alias fl="flutter run -d web-server --web-port 8080 --web-hostname 0.0.0.0 --web-browser-flag=--disable-web-security"
alias vi="nvim"
alias vim="nvim"

# pnpm
export PNPM_HOME="/Users/demian/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# pnpm end
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
