---Plugin installation module
---Handles downloading and installing plugins via vim.pack.add
require('pack.types')
local registry = require('pack.registry')

local M = {}

---Convert Plugin objects to vim.pack.Spec format
---@param plugins Plugin[]
---@return vim.pack.Spec[]
function M.to_spec(plugins)
	return vim.tbl_map(function(plugin)
		return {
			name = plugin.name,
			version = plugin.version,
			src = 'https://github.com/' .. plugin.repo,
		}
	end, plugins)
end

---Install plugins that are not already registered
---@param plugins Plugin[]
function M.install_all(plugins)
	local will_be_installed = {}
	for _, plugin in ipairs(plugins) do
		if not registry.is_registered(plugin.repo) then
			table.insert(will_be_installed, plugin)
			registry.set(plugin.repo, 'installed')
		end
	end

	if #will_be_installed > 0 then
		vim.pack.add(M.to_spec(will_be_installed), { confirm = false })
	end
end

return M
