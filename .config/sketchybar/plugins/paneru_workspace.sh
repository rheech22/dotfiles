#!/bin/bash
# $NAME is "paneru.<n>"; the trailing number is the workspace it stands for.
sid="${NAME##*.}"
current="$(paneru query active --json 2>/dev/null | jq -r '.virtual_workspace_number // empty')"

if [ "$sid" = "$current" ]; then
	sketchybar --set "$NAME" icon.color="${BG:-0xff141415}" background.color="${ACCENT:-0xff6e94b2}"
else
	sketchybar --set "$NAME" icon.color="${DIM:-0xff8b8b8b}" background.color="${SURFACE:-0xff282830}"
fi
