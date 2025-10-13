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

# mise
eval "$(mise activate zsh)"
eval "$(mise activate zsh --shims)"

# java
export JAVA_HOME="$(dirname "$(dirname "$(mise which java)")")"
export GRADLE_JAVA_HOME="$JAVA_HOME"
export GRADLE_OPTS="$GRADLE_OPTS -Dorg.gradle.java.installations.paths=$JAVA_HOME -Dorg.gradle.java.installations.fromPath=true"

# Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# ruby
export PATH="$HOME/.rbenv/bin:$PATH"
eval "$(rbenv init -)"

# go
export PATH="$PATH/go/bin:$PATH"

# alias
alias git="LANG=en_GB.UTF-8 git"
alias ll="ls | lolcat -F 1 -p 88"
alias lla="ls -al | lolcat -F 1 -p 88"
alias lg="lazygit"
alias vi="nvim"
alias vim="nvim"
alias cl="claude"

## projects
alias qms="cd ~/Projects/qms-web/"
alias rc="cd ~/Projects/realclass2-web"
alias rcapp="cd ~/Projects/realclass2-react-native"
alias rs="cd ~/Projects/real-mate-web"
alias rsapp="cd ~/Projects/real_speaking_app"
alias vw="cd ~/Projects/vestway-web"
alias vwapp="cd ~/Projects/vestway_app"
alias ca="cursor-agent"

# pnpm
export PNPM_HOME="/$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" 


# bun
[ -s "/Users/ch22/.bun/_bun" ] && source "$HOME/.bun/_bun"
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# opencode
export PATH=/Users/ch22/.opencode/bin:$PATH
