---
description: Code review (upstream|file <path>|commit <n>|staged)
agent: review
subtask: true
---

Mode: $1
Args: $ARGUMENTS

## Mode Handling

### If mode is `upstream`:
Run these commands to collect the diff:
!`BASE=$(git merge-base HEAD @{u} 2>/dev/null || git merge-base HEAD origin/HEAD 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null) && git diff $BASE HEAD && git diff HEAD && git diff --cached`

### If mode is `file`:
Target path: $2
Run these commands to collect the diff:
!`BASE=$(git merge-base HEAD @{u} 2>/dev/null || git merge-base HEAD origin/HEAD 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null) && git diff $BASE HEAD -- $2 && git diff HEAD -- $2 && git diff --cached -- $2`

### If mode is `commit`:
N: $2
Run these commands to collect the diff:
!`git diff HEAD~$2...HEAD && git diff HEAD && git diff --cached`

### If mode is `staged`:
Run these commands to collect the diff:
!`git diff HEAD && git diff --cached`

### If mode is missing or invalid:
Explain valid usage:
- `/review upstream` — full review since branch point (commits + staged + unstaged)
- `/review file <path>` — specific file review (upstream range + working tree)
- `/review commit <n>` — last N commits + staged + unstaged
- `/review staged` — staged and unstaged changes only
