#!/bin/bash
# $NAME is "ws.<sketchybar display>.<workspace number>".
. "$CONFIG_DIR/plugins/paneru_display.sh"

sb_display="${NAME#ws.}"
sb_display="${sb_display%%.*}"
wsnum="${NAME##*.}"

paneru_display="$(paneru_display_for "$sb_display")"
[ -z "$paneru_display" ] && exit 0
current="$(paneru_current_row "$paneru_display")"

if [ "$wsnum" = "$current" ]; then
	sketchybar --set "$NAME" icon.color="$BG" background.color="$ACCENT"
else
	sketchybar --set "$NAME" icon.color="$DIM" background.color="$SURFACE"
fi
