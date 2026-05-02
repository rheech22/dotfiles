local state = require("themes.state")
local signal = require("themes.signal")
local external_sync = require("themes.external-sync")
local tabline = require("themes.tabline")

local M = {}

local function resolve_theme_name(name)
	local ok, applied = external_sync.sync_external_tools(name)
	return ok, applied or name
end

function M.resolve_startup_theme(name)
	local ok, theme_name = resolve_theme_name(name)
	if ok and theme_name ~= name then
		state.save_state(theme_name)
	end
	return theme_name
end

function M.apply_terminal(window, name)
	state.save_state(name)
	tabline.apply(window, name)
	return true, name
end

function M.apply_global(window, name, opts)
	opts = opts or {}

	local ok, theme_name = resolve_theme_name(name)
	state.save_state(theme_name)
	tabline.apply(window, theme_name)

	if opts.broadcast_nvim and ok then
		signal.broadcast_to_nvim()
	end
	if opts.broadcast_zsh and ok then
		signal.broadcast_to_zsh()
	end

	return ok, theme_name
end

return M
