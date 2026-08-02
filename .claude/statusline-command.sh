#!/bin/sh
input=$(cat)

user=$(whoami)
host=$(hostname -s)
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')
branch=$(echo "$input" | jq -r '.workspace.repo | if . then .owner + "/" + .name else empty end')
git_branch=$(cd "$cwd" 2>/dev/null && git -c gc.auto=0 branch --show-current 2>/dev/null)
model=$(echo "$input" | jq -r '.model.display_name // empty')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Build line 1: user@host dir [git-branch] | model | context%
line1=""

# user@host
printf "\033[38;2;205;205;205m%s@%s\033[0m " "$user" "$host"

# directory
printf "\033[38;2;205;205;205m%s\033[0m" "$cwd"

# git branch
if [ -n "$git_branch" ]; then
  printf " \033[38;2;0;255;0m%s\033[0m" "$git_branch"
fi

# model
if [ -n "$model" ]; then
  printf " \033[38;2;107;148;178m%s\033[0m" "$model"
fi

# context remaining
if [ -n "$remaining" ]; then
  printf " \033[38;2;127;165;99mctx:%.0f%%\033[0m" "$remaining"
fi

printf "\n"
