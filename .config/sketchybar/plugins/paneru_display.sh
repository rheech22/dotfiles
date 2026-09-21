#!/bin/sh
# Shared constants and helpers, sourced by every plugin.
#
# sketchybarrc's `export` does NOT reach plugin scripts: sketchybar spawns them
# itself, not from the config shell, and passes only CONFIG_DIR. Anything both
# the config and the plugins need lives here and is sourced by both.

MAX_WINDOWS=8
WORKSPACES=3

# vague — neutrals from wezterm/themes/palettes.lua, accents from
# starship/themes/vague.toml.
BG=0xff141415
SURFACE=0xff282830
FG=0xffcdcdcd
DIM=0xff8b8b8b
ACCENT=0xff6e94b2
MAUVE=0xffbb9dbd

# SketchyBar numbers displays by arrangement; Paneru reports CoreGraphics ids.
# sketchybarrc refreshes this machine-owned cache once at startup. Plugins only
# source it, avoiding repeated Swift processes and stale ids after docking.
PANERU_DISPLAY_CACHE_DIR="$HOME/Library/Caches/sketchybar"
PANERU_DISPLAY_MAP_FILE="$PANERU_DISPLAY_CACHE_DIR/paneru-display-map.sh"

paneru_refresh_display_map() {
	displays="$(sketchybar --query displays 2>/dev/null)" || return 1
	[ -n "$displays" ] || return 1
	builtin_id="$(/usr/bin/swift -e 'import CoreGraphics
var count: UInt32 = 0
CGGetActiveDisplayList(0, nil, &count)
var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
CGGetActiveDisplayList(count, &ids, &count)
if let id = ids.first(where: { CGDisplayIsBuiltin($0) != 0 }) { print(id) }' 2>/dev/null)" || builtin_id=""

	mkdir -p "$PANERU_DISPLAY_CACHE_DIR" || return 1
	tmp_map="$(mktemp "$PANERU_DISPLAY_CACHE_DIR/paneru-display-map.XXXXXX")" || return 1
	if ! {
		printf "PANERU_SKETCHYBAR_DISPLAYS='%s'\n" "$(printf '%s\n' "$displays" | jq -r '[.[]."arrangement-id"] | map(tostring) | join(" ")')"
		printf '%s\n' "$displays" | jq -r '.[] | "PANERU_DISPLAY_\(."arrangement-id")=\(.DirectDisplayID)"'
		printf 'PANERU_BUILTIN_DISPLAY=%s\n' "$(printf '%s\n' "$displays" | jq -r --arg id "$builtin_id" '[.[] | select((.DirectDisplayID | tostring) == $id) | ."arrangement-id"] | first // ""')"
	} >"$tmp_map"; then
		rm -f "$tmp_map"
		return 1
	fi
	chmod 600 "$tmp_map"
	mv "$tmp_map" "$PANERU_DISPLAY_MAP_FILE" || return 1
	. "$PANERU_DISPLAY_MAP_FILE"
}

if [ -r "$PANERU_DISPLAY_MAP_FILE" ]; then
	. "$PANERU_DISPLAY_MAP_FILE"
fi

paneru_sketchybar_displays() {
	printf '%s' "${PANERU_SKETCHYBAR_DISPLAYS:-}"
}

paneru_builtin_sketchybar_display() {
	printf '%s' "${PANERU_BUILTIN_DISPLAY:-}"
}

# Echoes the paneru display id for a SketchyBar display number.
paneru_display_for() {
	eval "printf '%s' \"\${PANERU_DISPLAY_$1:-}\""
}

# Echoes the virtual workspace number currently shown on a paneru display.
#
# For the display that holds focus, `paneru query active` states it outright —
# no inference needed, and this is the display the user just acted on.
#
# For any other display there is no direct answer: the `active` flag in
# `query state` is global, so an unfocused display's row always reads false.
# Fall back to the row holding a window that is visible on that display.
#
# That inference cannot see an empty row — switching to one leaves nothing
# visible to point at — which is why the active display is answered first.
# An unfocused display sitting on an empty row still reports 1.
paneru_current_row() {
	paneru query state --json 2>/dev/null | jq -r --argjson d "$1" '
		if .active.display_id == $d then
			.active.virtual_workspace_number
		else
			[ .virtual_workspaces[]
			  | select([.windows[] | select(.display_id == $d and .visible)] | length > 0)
			  | .number ] | first // 1
		end'
}
