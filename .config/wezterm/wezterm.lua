local wezterm = require("wezterm")

local commands = require("commands")
local themes = require("themes")
local hostname = wezterm.hostname()

local config = wezterm.config_builder()
local act = wezterm.action

-- Font settings
config.font = wezterm.font("DankMono Nerd Font")
if hostname == "ichanghyeogs-MacBook-Pro.local" then
	config.font_size = 14.5
else
	config.font_size = 18
end

-- Colors
local current_theme = themes.load_state()
local startup_ok, startup_theme = themes.sync_external_tools(current_theme)
if not startup_ok then
	startup_theme = "vague"
end
config.colors = themes.get(startup_theme)
if startup_theme ~= current_theme then
	themes.save_state(startup_theme)
end

-- Appearance
config.underline_thickness = "200%"
config.underline_position = "200%"
config.window_decorations = "RESIZE | MACOS_FORCE_DISABLE_SHADOW | MACOS_FORCE_SQUARE_CORNERS"
config.tab_bar_at_bottom = true
config.use_fancy_tab_bar = false
-- config.hide_tab_bar_if_only_one_tab = true
config.window_padding = {
	left = 0,
	right = 0,
	top = 0,
	bottom = 0,
}

-- config.window_background_image = constants.bg_blurred
-- config.macos_window_background_blur = 38
-- config.window_background_opacity = constants.opacity
config.command_palette_font_size = 16
config.command_palette_bg_color = "#5E4090"
config.command_palette_rows = 10

-- Keymaps
config.keys = {
	-- Split Pane
	{
		key = "H",
		mods = "CMD|SHIFT",
		action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }),
	},
	{
		key = "V",
		mods = "CMD|SHIFT",
		action = act.SplitVertical({ domain = "CurrentPaneDomain" }),
	},
	-- Activate pane
	{
		key = "H",
		mods = "CTRL|SHIFT",
		action = act.ActivatePaneDirection("Left"),
	},
	{
		key = "L",
		mods = "CTRL|SHIFT",
		action = act.ActivatePaneDirection("Right"),
	},
	{
		key = "K",
		mods = "CTRL|SHIFT",
		action = act.ActivatePaneDirection("Up"),
	},
	{
		key = "J",
		mods = "CTRL|SHIFT",
		action = act.ActivatePaneDirection("Down"),
	},
	-- Rotate Pane
	{
		key = "P",
		mods = "SHIFT|ALT",
		action = act.RotatePanes("CounterClockwise"),
	},
	{ key = "N", mods = "SHIFT|ALT", action = act.RotatePanes("Clockwise") },
	-- Resize Pane
	{
		key = "H",
		mods = "SHIFT|ALT",
		action = act.AdjustPaneSize({ "Left", 5 }),
	},
	{
		key = "J",
		mods = "SHIFT|ALT",
		action = act.AdjustPaneSize({ "Down", 5 }),
	},
	{ key = "K", mods = "SHIFT|ALT", action = act.AdjustPaneSize({ "Up", 5 }) },
	{
		key = "L",
		mods = "SHIFT|ALT",
		action = act.AdjustPaneSize({ "Right", 5 }),
	},
	-- Close Pane
	{
		key = "w",
		mods = "CMD",
		action = act.CloseCurrentPane({ confirm = true }),
	},
}

-- Nvim theme sync
wezterm.on("user-var-changed", function(window, pane, name, value)
	if name == "nvim_theme" then
		local ok, applied = themes.sync_external_tools(value)
		if not ok then
			return
		end

		local overrides = window:get_config_overrides() or {}
		overrides.colors = themes.get(applied)
		window:set_config_overrides(overrides)
		themes.save_state(applied)
		themes.broadcast_to_zsh()
		-- We don't broadcast_to_nvim here because this signal came FROM nvim.
		-- Broadcasting would trigger the sender to reload itself unnecessarily.
	end
end)

-- Custom Commands
wezterm.on("augment-command-palette", function()
	return commands
end)

-- ETC
config.max_fps = 120
config.prefer_egl = true

return config
