---Plugin setup/configuration module
---Loads and executes plugin configuration files
require('pack.types')
local paths = require 'pack.paths'
local registry = require('pack.registry')

local M = {}

---@param path string
---@return table | nil setup_table table with config function, or nil if error
function M.load_path(path)
	local ok1, chunk = pcall(loadfile, path)
	if not ok1 or not chunk then
		return nil
	end
	local ok2, setup = pcall(chunk)
	if not ok2 or type(setup) ~= 'table' then
		return nil
	end
	return setup
end

---@param dir string
---@param plugin Plugin
---@return table | nil
function M.load(dir, plugin)
	local concern_path = paths.setup_path(plugin)
	if concern_path then
		local concern_setup = M.load_path(concern_path)
		if concern_setup then
			return concern_setup
		end
	end

	if not dir then
		return nil
	end

	return M.load_path(dir .. plugin.name .. '.lua')
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
			local setup = M.load(dir, plugin)
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
