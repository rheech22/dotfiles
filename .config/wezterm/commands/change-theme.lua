local wezterm = require("wezterm")
local themes = require("themes")

local commands = {}

for _, name in ipairs(themes.names) do
	table.insert(commands, {
		brief = "Theme (Terminal): " .. name,
		icon = "md_monitor",
		action = wezterm.action_callback(function(window)
			themes.apply_terminal(window, name)
		end),
	})

	table.insert(commands, {
		brief = "Theme (Global): " .. name,
		icon = "md_palette",
		action = wezterm.action_callback(function(window, _)
			themes.apply_global(window, name, {
				broadcast_nvim = true,
				broadcast_zsh = true,
			})
		end),
	})
end

return commands
