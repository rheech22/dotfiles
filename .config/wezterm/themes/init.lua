local palettes = require("themes.palettes")
local state = require("themes.state")
local external_sync = require("themes.external-sync")
local signal = require("themes.signal")

local M = {}

for key, value in pairs(palettes) do
	M[key] = value
end

M.load_state = state.load_state
M.save_state = state.save_state

M.sync_starship = external_sync.sync_starship
M.sync_lazygit = external_sync.sync_lazygit
M.sync_external_tools = external_sync.sync_external_tools

M.broadcast_to_nvim = signal.broadcast_to_nvim
M.broadcast_to_zsh = signal.broadcast_to_zsh

return M
