#!/bin/bash
# Switch a virtual workspace only after Paneru is focused on the display whose
# SketchyBar item was clicked. `virtualnum` itself has no display argument.

target_display="$1"
workspace="$2"
case "$target_display:$workspace" in
	*[!0-9:]* | :* | *:) exit 0 ;;
esac

active_display() {
	paneru query active --json 2>/dev/null | jq -r '.display_id // empty'
}

active="$(active_display)"
if [ "$active" != "$target_display" ]; then
	# A click puts the pointer on the target bar but does not necessarily focus
	# a window there. With two displays, the first hop synchronizes the pointer
	# and Paneru focus on the other display; the second returns to the clicked
	# display and explicitly focuses its most visible window. Poll after every
	# hop and fail closed if Paneru still reports a different display.
	for _attempt in 1 2 3; do
		paneru send-cmd mouse nextdisplay >/dev/null 2>&1 || exit 0
		sleep 0.12
		active="$(active_display)"
		[ "$active" = "$target_display" ] && break
	done
fi

[ "$active" = "$target_display" ] || exit 0
paneru send-cmd window virtualnum "$workspace" >/dev/null 2>&1
