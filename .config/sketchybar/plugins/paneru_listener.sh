#!/bin/bash
# Turns paneru's event stream into a single SketchyBar event.
#
# Window titles can change many times per second (for example, a terminal tab
# with an animated spinner). Paneru emits both window_title_changed and
# on_screen_changed for those updates, while this bar only renders app names.
# Compare the state that the bar actually uses so title-only events do not
# launch every SketchyBar plugin and query Paneru again.
while true; do
	paneru subscribe --json 2>/dev/null |
		jq --unbuffered -c '
			if .event == "window_title_changed" then empty
			elif .event == "on_screen_changed" then {
				active: [.active.display_id, .active.native_workspace_id,
					.active.virtual_workspace_number, .active.focused_window_id],
				windows: [.windows[]? | [.window_id, .display_id, .focused,
					.floating, .visible, .frame]]
			}
			else .
			end' 2>/dev/null |
		awk '$0 != previous { print; fflush(); previous = $0 }' |
	while read -r _state; do
		sketchybar --trigger paneru_change
	done
	sleep 2
done
