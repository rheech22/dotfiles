---Plugin setup/configuration module
---Loads and executes plugin configuration files
require('pack.types')
local registry = require('pack.registry')

local M = {}

---Load setup file for a plugin
---@param dir string directory containing plugin setup files
---@param plugin_name string name of the plugin (filename without .lua)
---@return table | nil setup_table table with config function, or nil if error
function M.load(dir, plugin_name)
	local ok1, chunk = pcall(loadfile, dir .. plugin_name .. '.lua')
	if not ok1 or not chunk then
		return nil
	end
	local ok2, setup = pcall(chunk)
	if not ok2 or type(setup) ~= 'table' then
		return nil
	end
	return setup
end

---Configure all plugins by loading and executing their config functions
---@param dir string directory containing plugin setup files
---@param plugins Plugin[]
function M.configure_all(dir, plugins)
	for _, plugin in ipairs(plugins) do
		if not plugin.name then
			goto continue
		end

		if registry.get(plugin.repo) == 'installed' then
			local setup = M.load(dir, plugin.name)
			if setup and setup.config then
				local ok, err = pcall(setup.config)
				if ok then
					registry.set(plugin.repo, 'configured')
				else
					vim.notify(
						'Config failed for ' .. plugin.repo .. ':\n' .. tostring(err),
						vim.log.levels.ERROR
					)
				end
			end
		end

		::continue::
	end
end

return M
