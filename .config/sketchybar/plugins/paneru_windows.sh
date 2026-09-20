#!/bin/bash
# Fills the pre-created win.* slots from paneru's current virtual workspace.
#
# One query per event, no polling: paneru_listener.sh only fires when paneru
# says something actually changed. The reference config this borrows its look
# from enumerated every process over AppleScript every 2s; paneru already
# knows, and answers instantly.
# Set by sketchybarrc, which creates the slots.
MAX_WINDOWS="${MAX_WINDOWS:-8}"

rows="$(paneru query state --json 2>/dev/null |
	jq -r '.virtual_workspaces[] | select(.active) | .windows[]
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
			bg="${MAUVE:-0xffbb9dbd}"
		else
			bg="${ACCENT:-0xff6e94b2}"
		fi
		fg="${BG:-0xff141415}"
	else
		bg="${SURFACE:-0xff282830}"
		if [ "$floating" = "true" ]; then
			fg="${MAUVE:-0xffbb9dbd}"
		elif [ "$visible" = "false" ]; then
			fg="${DIM:-0xff8b8b8b}"
		else
			fg="${FG:-0xffcdcdcd}"
		fi
	fi

	# Truncated so a run of long names cannot grow the left block into the
	# centred workspace items.
	if [ "${#app}" -gt 16 ]; then
		app="${app:0:15}…"
	fi

	# `window focus` counts from 1, the array from 0.
	sketchybar --set "win.$i" \
		drawing=on \
		label="$app" \
		label.color="$fg" \
		background.color="$bg" \
		click_script="paneru send-cmd window focus $((i + 1))"
	i=$((i + 1))
done <<<"$rows"

while [ "$i" -lt "$MAX_WINDOWS" ]; do
	sketchybar --set "win.$i" drawing=off
	i=$((i + 1))
done
