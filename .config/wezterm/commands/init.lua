local toggle_transparency = require("commands.toggle-transparency")
local theme_commands = require("commands.change-theme")

local M = {
	toggle_transparency,
}

for _, cmd in ipairs(theme_commands) do
	table.insert(M, cmd)
end

return M
