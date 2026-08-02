#!/bin/zsh

set -eu

if [[ ${ZSH_EVAL_CONTEXT:-} == *:file ]]; then
  print -u2 "source-dots.sh: do not source this file; execute it instead"
  return 1
fi

DOTFILES_DIR=${0:A:h}
exec "$DOTFILES_DIR/bin/dots" "$@"
