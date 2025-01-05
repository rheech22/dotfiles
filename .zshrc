eval "$(starship init zsh)"

export ZSH="$HOME/.oh-my-zsh"
export TERM="xterm-256color"
export EDITOR="/usr/local/bin/nvim"

source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
source $(brew --prefix)/opt/zsh-vi-mode/share/zsh-vi-mode/zsh-vi-mode.plugin.zsh
source $HOME/.local/bin/env

# ZSH_THEME="spaceship"
# DEFAULT_USER prompt_context(){}
plugins=(git)

export PATH="$HOME/flutter/bin:$PATH"
export LIBRARY_PATH=$LIBRARY_PATH:/opt/homebrew/opt/openssl/lib

alias brew='arch -x86_64 /usr/local/bin/brew'
alias git="LANG=en_GB.UTF-8 git"
alias vimdiff="nvim -d"
# if u are not using lolcat, delete it below !
alias lla="ls -al | lolcat"
alias hs="history | tail -n 10 | lolcat"
alias t3="docker exec -i daphne ./manage.py"
alias dkr="docker compose down && docker compose up --build -d"
alias lg="lazygit"
# alias python="/usr/local/bin/python3.13"
# alias python="/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"

# NVM
export NVM_DIR="$HOME/.nvm"
. "$(brew --prefix nvm)/nvm.sh"

source $ZSH/oh-my-zsh.sh


. "$HOME/.local/bin/env"
