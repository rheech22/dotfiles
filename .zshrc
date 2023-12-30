export ZSH="$HOME/.oh-my-zsh"
export TERM="xterm-256color"
export EDITOR="/usr/local/bin/nvim"

source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

ZSH_THEME="spaceship"
DEFAULT_USER prompt_context(){}
plugins=(git)

export PATH="/usr/local/opt/libpq/bin:$PATH"
export LIBRARY_PATH=$LIBRARY_PATH:/opt/homebrew/opt/openssl/lib

alias brew='arch -x86_64 /usr/local/bin/brew'
alias git="LANG=en_GB.UTF-8 git"
alias vimdiff="nvim -d"
alias lla="ls -al | lolcat"

# NVM
export NVM_DIR="$HOME/.nvm"
. "$(brew --prefix nvm)/nvm.sh"

source $ZSH/oh-my-zsh.sh
