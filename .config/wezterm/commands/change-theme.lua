local wezterm = require("wezterm")
local themes = require("themes")

local commands = {}

for _, name in ipairs(themes.names) do
	table.insert(commands, {
		brief = "Theme: " .. name,
		icon = "md_palette",
		action = wezterm.action_callback(function(window)
			local overrides = window:get_config_overrides() or {}
			overrides.colors = themes.get(name)
			window:set_config_overrides(overrides)
			themes.sync_starship(name)
			themes.save_state(name)
			themes.broadcast_to_nvim()
		end),
	})
end

return commands
