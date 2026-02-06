local M = {}

-- default (vague)
M.default = {
	background = "#141415",
	foreground = "#cdcdcd",
	cursor_bg = "#ffffff",
	cursor_border = "#ffffff",
	selection_fg = "#c3c3d5",
	selection_bg = "#333738",
	split = "#282830",
	tab_bar = {
		background = "#141415",

		active_tab = {
			bg_color = "#282830",
			fg_color = "#cdcdcd",
			intensity = "Bold",
		},

		inactive_tab = {
			bg_color = "#141415",
			fg_color = "#8b8b8b",
		},

		inactive_tab_hover = {
			bg_color = "#cdcdcd",
			fg_color = "#141415",
			italic = true,
		},

		new_tab = {
			bg_color = "#141415",
			fg_color = "#cdcdcd",
		},

		new_tab_hover = {
			bg_color = "#cdcdcd",
			fg_color = "#141415",
		},
	},
}
M.vague = M.default

-- catppuccin-latte
M["catppuccin-latte"] = {
	background = "#eff1f5",
	foreground = "#4c4f69",
	cursor_bg = "#dc8a78",
	cursor_border = "#dc8a78",
	selection_fg = "#4c4f69",
	selection_bg = "#acb0be",
	split = "#ccd0da",
	tab_bar = {
		background = "#eff1f5",

		active_tab = {
			bg_color = "#e6e9ef",
			fg_color = "#1e66f5",
			intensity = "Bold",
		},

		inactive_tab = {
			bg_color = "#eff1f5",
			fg_color = "#4c4f69",
		},

		inactive_tab_hover = {
			bg_color = "#1e66f5",
			fg_color = "#eff1f5",
			italic = true,
		},

		new_tab = {
			bg_color = "#eff1f5",
			fg_color = "#1e66f5",
		},

		new_tab_hover = {
			bg_color = "#1e66f5",
			fg_color = "#eff1f5",
		},
	},
}

-- teide-darker
M["teide-darker"] = {
	background = "#171B20",
	foreground = "#E7EAEE",
	cursor_bg = "#E7EAEE",
	cursor_border = "#E7EAEE",
	selection_fg = "#E7EAEE",
	selection_bg = "#2f3546",
	split = "#2f3546",
	tab_bar = {
		background = "#171B20",

		active_tab = {
			bg_color = "#21262d",
			fg_color = "#5CCEFF",
			intensity = "Bold",
		},

		inactive_tab = {
			bg_color = "#171B20",
			fg_color = "#8b949e",
		},

		inactive_tab_hover = {
			bg_color = "#5CCEFF",
			fg_color = "#171B20",
			italic = true,
		},

		new_tab = {
			bg_color = "#171B20",
			fg_color = "#E7EAEE",
		},

		new_tab_hover = {
			bg_color = "#5CCEFF",
			fg_color = "#171B20",
		},
	},
}

-- everforest (light medium)
M["everforest"] = {
	background = "#FDF6E3",
	foreground = "#5c6a72",
	cursor_bg = "#859900",
	cursor_border = "#859900",
	selection_fg = "#5c6a72",
	selection_bg = "#e5dfc5",
	split = "#e5dfc5",
	tab_bar = {
		background = "#FDF6E3",

		active_tab = {
			bg_color = "#e9e8d2",
			fg_color = "#859900",
			intensity = "Bold",
		},

		inactive_tab = {
			bg_color = "#f8f0dc",
			fg_color = "#939f91",
		},

		inactive_tab_hover = {
			bg_color = "#859900",
			fg_color = "#f8f0dc",
			italic = true,
		},

		new_tab = {
			bg_color = "#f8f0dc",
			fg_color = "#5c6a72",
		},

		new_tab_hover = {
			bg_color = "#859900",
			fg_color = "#f8f0dc",
		},
	},
}

M.names = { "vague", "catppuccin-latte", "teide-darker", "everforest" }

function M.get(name)
	return M[name] or M.default
end

function M.load_state()
	local file = io.open(os.getenv("HOME") .. "/.cache/nvim_theme.txt", "r")
	if file then
		local scheme = file:read("*all"):gsub("%s+", "")
		file:close()
		return scheme
	end
	return "vague"
end

function M.sync_starship(scheme)
	local wezterm = require("wezterm")
	local scheme_lower = scheme:lower()
	local palette = (scheme_lower:find("latte") or scheme_lower:find("everforest")) and "light" or "dark"

	-- Use absolute path to the actual file (not the symlink) to avoid sed error on macOS
	local starship_conf = os.getenv("HOME") .. "/dotfiles/.config/starship/starship.toml"

	-- Use run_child_process for more robust execution in Wezterm
	wezterm.run_child_process({
		"sed",
		"-i",
		"",
		'1s/.*/palette = "' .. palette .. '"/',
		starship_conf,
	})

	wezterm.log_info(string.format("[Theme Sync] Scheme: %s -> Palette: %s", scheme, palette))
end

function M.save_state(scheme)
	local cache_dir = os.getenv("HOME") .. "/.cache"
	os.execute("mkdir -p " .. cache_dir)
	local file = io.open(cache_dir .. "/nvim_theme.txt", "w")
	if file then
		file:write(scheme)
		file:close()
	end
end

function M.broadcast_to_nvim()
	local wezterm = require("wezterm")
	-- Send SIGUSR1 to all nvim processes
	wezterm.run_child_process({ "pkill", "-USR1", "nvim" })
end

return M
