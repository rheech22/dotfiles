local M = {}

function M.broadcast_to_nvim()
	local wezterm = require("wezterm")
	wezterm.run_child_process({ "pkill", "-USR1", "nvim" })
end

function M.broadcast_to_zsh()
	local wezterm = require("wezterm")
	wezterm.run_child_process({ "pkill", "-USR1", "zsh" })
end

return M
