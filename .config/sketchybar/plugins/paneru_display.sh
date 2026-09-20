#!/bin/sh
# Shared constants and helpers, sourced by every plugin.
#
# sketchybarrc's `export` does NOT reach plugin scripts: sketchybar spawns them
# itself, not from the config shell, and passes only CONFIG_DIR. Anything both
# the config and the plugins need lives here and is sourced by both.

MAX_WINDOWS=8
WORKSPACES=2

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
# The `active` flag in `paneru query state` is global — it marks the row that
# holds focus, so the other display's row always reads false. A row is the one
# on screen for its display if it holds a window that is visible there.
#
# A display with no windows leaves nothing to infer from; assume row 1.
paneru_current_row() {
	paneru query state --json 2>/dev/null | jq -r --argjson d "$1" '
		[ .virtual_workspaces[]
		  | select([.windows[] | select(.display_id == $d and .visible)] | length > 0)
		  | .number ] | first // 1'
}
