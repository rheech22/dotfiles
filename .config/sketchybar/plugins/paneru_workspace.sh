#!/bin/bash
# Updates every display's workspace controls from one Paneru state snapshot.
. "$CONFIG_DIR/plugins/paneru_display.sh"

state="$(paneru query state --json 2>/dev/null)" || exit 0
[ -n "$state" ] || exit 0
for sb_display in $(paneru_sketchybar_displays); do
	paneru_display="$(paneru_display_for "$sb_display")"
	[ -z "$paneru_display" ] && continue

	current="$(printf '%s\n' "$state" | jq -r --argjson d "$paneru_display" '
		if .active.display_id == $d then
			.active.virtual_workspace_number
		else
			[ .virtual_workspaces[]
			  | select([.windows[] | select(.display_id == $d and .visible)] | length > 0)
			  | .number ] | first // 1
		end')"

	for wsnum in $(seq 1 "$WORKSPACES"); do
		click_script="$CONFIG_DIR/plugins/paneru_workspace_click.sh $paneru_display $wsnum"
		if [ "$wsnum" = "$current" ]; then
			sketchybar --set "ws.$sb_display.$wsnum" icon.color="$BG" background.color="$ACCENT" click_script="$click_script"
		else
			sketchybar --set "ws.$sb_display.$wsnum" icon.color="$DIM" background.color="$SURFACE" click_script="$click_script"
		fi
	done
done
