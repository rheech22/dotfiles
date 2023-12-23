export ZSH="/Users/demian/.oh-my-zsh"

export TERM="tmux-256color"

ZSH_THEME="spaceship"

plugins=(git)

source $ZSH/oh-my-zsh.sh


alias git="LANG=en_GB.UTF-8 git"

export PATH="/usr/local/opt/libpq/bin:$PATH"
export LIBRARY_PATH=$LIBRARY_PATH:/opt/homebrew/opt/openssl/lib

source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
alias brew='arch -x86_64 /usr/local/bin/brew'

DEFAULT_USER prompt_context(){}

alias vimdiff="nvim -d"

# gitui
alias zz="export GIT_EDITOR='code' && gitui -t mocha.ron"

# editor
export EDITOR="/usr/local/bin/nvim"

# NVM
export NVM_DIR="$HOME/.nvm"
. "$(brew --prefix nvm)/nvm.sh"
