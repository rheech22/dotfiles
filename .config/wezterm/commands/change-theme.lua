local wezterm = require("wezterm")
local themes = require("themes")

local commands = {}

for _, name in ipairs(themes.names) do
	table.insert(commands, {
		brief = "Theme (Terminal): " .. name,
		icon = "md_monitor",
		action = wezterm.action_callback(function(window)
			local overrides = window:get_config_overrides() or {}
			overrides.colors = themes.get(name)
			window:set_config_overrides(overrides)
		end),
	})

	table.insert(commands, {
		brief = "Theme (Global): " .. name,
		icon = "md_palette",
		action = wezterm.action_callback(function(window)
			local ok, applied = themes.sync_external_tools(name)
			if not ok then
				return
			end

			local overrides = window:get_config_overrides() or {}
			overrides.colors = themes.get(applied)
			window:set_config_overrides(overrides)
			themes.save_state(applied)
			themes.broadcast_to_nvim()
			themes.broadcast_to_zsh()
		end),
	})
end

return commands
