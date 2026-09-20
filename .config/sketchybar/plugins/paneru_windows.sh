#!/bin/bash
# Fills the pre-created win.<display>.* slots from the row currently shown on
# that display.
#
# One query per event, no polling: paneru_listener.sh only fires when paneru
# says something actually changed. The reference config this borrows its look
# from enumerated every process over AppleScript every 2s; paneru already
# knows, and answers instantly.
. "$CONFIG_DIR/plugins/paneru_display.sh"

sb_display="${NAME##*.}"
paneru_display="$(paneru_display_for "$sb_display")"
[ -z "$paneru_display" ] && exit 0

current="$(paneru_current_row "$paneru_display")"

rows="$(paneru query state --json 2>/dev/null |
	jq -r --argjson d "$paneru_display" --argjson n "$current" '
		.virtual_workspaces[] | select(.number == $n) | .windows[]
		| select(.display_id == $d)
		| [.app_name, (.focused | tostring), (.floating | tostring),
		   (.visible | tostring)] | @tsv')"

i=0
while IFS=$'\t' read -r app focused floating visible; do
	[ -z "$app" ] && continue
	[ "$i" -ge "$MAX_WINDOWS" ] && break

	# Colour carries state rather than decoration, so the bar stays inside
	# vague's restraint while saying more:
	#   mauve    — floating, i.e. outside paneru's tiling rules. Invisible
	#              otherwise; `alt - t` leaves no other trace here.
	#   dim text — scrolled off screen. With sliver_width = 1 a neighbouring
	#              window shows a single pixel, so the bar is the only place
	#              the rest of the strip is visible at all.
	# Otherwise full foreground, not the dim grey: MesloLGS ships only Regular
	# and Bold, so contrast stands in for a half-step of weight.
	if [ "$focused" = "true" ]; then
		if [ "$floating" = "true" ]; then
			bg="$MAUVE"
		else
			bg="$ACCENT"
		fi
		fg="$BG"
	else
		bg="$SURFACE"
		if [ "$floating" = "true" ]; then
			fg="$MAUVE"
		elif [ "$visible" = "false" ]; then
			fg="$DIM"
		else
			fg="$FG"
		fi
	fi

	# Truncated so a run of long names cannot grow the left block into the
	# centred workspace items.
	if [ "${#app}" -gt 16 ]; then
		app="${app:0:15}…"
	fi

	# `window focus` counts from 1, the array from 0.
	sketchybar --set "win.$sb_display.$i" \
		drawing=on \
		label="$app" \
		label.color="$fg" \
		background.color="$bg" \
		click_script="paneru send-cmd window focus $((i + 1))"
	i=$((i + 1))
done <<<"$rows"

while [ "$i" -lt "$MAX_WINDOWS" ]; do
	sketchybar --set "win.$sb_display.$i" drawing=off
	i=$((i + 1))
done
