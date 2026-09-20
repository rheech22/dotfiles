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

# SketchyBar numbers displays by arrangement; paneru reports the CoreGraphics
# display id. They do not match. Re-derive with:
#
#   swift -e 'import CoreGraphics
#   var n: UInt32 = 0; CGGetActiveDisplayList(0, nil, &n)
#   var ids = [CGDirectDisplayID](repeating: 0, count: Int(n))
#   CGGetActiveDisplayList(n, &ids, &n)
#   for (i, id) in ids.enumerated() { print(i + 1, id) }'
#
# arrangement 1 = LG UltraFine = cgID 3
# arrangement 2 = Studio Display = cgID 2
PANERU_DISPLAY_1=3
PANERU_DISPLAY_2=2

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
