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

M["seoul256-light"] = {
	background = "#E1E1E1",
	foreground = "#616161",
	cursor_bg = "#0099BD",
	cursor_border = "#0099BD",
	selection_fg = "#616161",
	selection_bg = "#D9D9D9",
	split = "#D1D1D1",
	tab_bar = {
		background = "#E1E1E1",

		active_tab = {
			bg_color = "#D9D9D9",
			fg_color = "#719872",
			intensity = "Bold",
		},

		inactive_tab = {
			bg_color = "#E1E1E1",
			fg_color = "#757575",
		},

		inactive_tab_hover = {
			bg_color = "#D1D1D1",
			fg_color = "#0099BD",
			italic = true,
		},

		new_tab = {
			bg_color = "#E1E1E1",
			fg_color = "#616161",
		},

		new_tab_hover = {
			bg_color = "#D1D1D1",
			fg_color = "#0099BD",
		},
	},
}

M.names = { "vague", "seoul256-light" }

M.tabline = {
	vague = {
		colors = {
			background = "#141415",
			foreground = "#cdcdcd",
			cursor_bg = "#ffffff",
			ansi = { "#141415", "#8b4a3b", "#7fa563", "#c9a554", "#6e94b2", "#957fb8", "#5f8f8b", "#cdcdcd" },
			brights = { "#282830", "#b66a52", "#98bb6c", "#e6c384", "#7e9cd8", "#b8a0ff", "#7aa89f", "#ffffff" },
			tab_bar = {
				background = "#141415",
				inactive_tab = { bg_color = "#141415", fg_color = "#8b8b8b" },
			},
		},
		normal_mode = {
			a = { fg = "#cdcdcd", bg = "#333738" },
			b = { fg = "#cdcdcd", bg = "#282830" },
			c = { fg = "#8b8b8b", bg = "#141415" },
			x = { fg = "#8b8b8b", bg = "#141415" },
			y = { fg = "#cdcdcd", bg = "#282830" },
			z = { fg = "#cdcdcd", bg = "#333738" },
		},
		copy_mode = {
			a = { fg = "#cdcdcd", bg = "#8b4a3b" },
			b = { fg = "#cdcdcd", bg = "#282830" },
			c = { fg = "#8b8b8b", bg = "#141415" },
		},
		search_mode = {
			a = { fg = "#141415", bg = "#cdcdcd" },
			b = { fg = "#cdcdcd", bg = "#282830" },
			c = { fg = "#8b8b8b", bg = "#141415" },
		},
		tab = {
			active = { fg = "#cdcdcd", bg = "#282830" },
			inactive = { fg = "#8b8b8b", bg = "#141415" },
			inactive_hover = { fg = "#cdcdcd", bg = "#1c1c1f" },
		},
	},
	["seoul256-light"] = {
		colors = {
			background = "#E1E1E1",
			foreground = "#616161",
			cursor_bg = "#0099BD",
			ansi = { "#E1E1E1", "#BF2172", "#719872", "#9A7200", "#0099BD", "#9A7599", "#97DDDF", "#616161" },
			brights = { "#D9D9D9", "#E17899", "#98BC99", "#999872", "#98BCBD", "#BDBDBD", "#BCE0FF", "#FFFFFF" },
			tab_bar = {
				background = "#E1E1E1",
				inactive_tab = { bg_color = "#E1E1E1", fg_color = "#757575" },
			},
		},
		normal_mode = {
			a = { fg = "#E1E1E1", bg = "#719872" },
			b = { fg = "#616161", bg = "#D9D9D9" },
			c = { fg = "#757575", bg = "#E1E1E1" },
			x = { fg = "#757575", bg = "#E1E1E1" },
			y = { fg = "#616161", bg = "#D9D9D9" },
			z = { fg = "#E1E1E1", bg = "#719872" },
		},
		copy_mode = {
			a = { fg = "#E1E1E1", bg = "#BF2172" },
			b = { fg = "#616161", bg = "#D9D9D9" },
			c = { fg = "#757575", bg = "#E1E1E1" },
		},
		search_mode = {
			a = { fg = "#E1E1E1", bg = "#0099BD" },
			b = { fg = "#616161", bg = "#D9D9D9" },
			c = { fg = "#757575", bg = "#E1E1E1" },
		},
		tab = {
			active = { fg = "#719872", bg = "#D9D9D9" },
			inactive = { fg = "#757575", bg = "#E1E1E1" },
			inactive_hover = { fg = "#0099BD", bg = "#D1D1D1" },
		},
	},
}

function M.get(name)
	return M[name] or M.default
end

function M.tabline_overrides(name)
	return M.tabline[name] or M.tabline.vague
end

return M
