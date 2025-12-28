---Plugin build system
---Handles building plugins and tracking build state
require('pack.types')
local git = require('pack.git')
local state_manager = require('pack.state')
local registry = require('pack.registry')

local M = {}

---Get plugin directory path
---@param plugin_name string
---@return string
local function get_plugin_dir(plugin_name)
	return vim.fn.stdpath('data') .. '/site/pack/core/opt/' .. plugin_name
end

---Check if plugin needs to be built
---@param repo string plugin repository name
---@param plugin_dir string absolute path to plugin directory
---@param state BuildStateMap current build state
---@return boolean needs_build true if build is needed
function M.needs_build(repo, plugin_dir, state)
	local current_commit = git.get_commit(plugin_dir)
	if not current_commit then
		return true
	end

	local plugin_state = state[repo]
	if not plugin_state then
		return true
	end

	local dir_birth_time = git.get_dir_birth_time(plugin_dir)
	if dir_birth_time and plugin_state.last_built_time then
		if dir_birth_time > plugin_state.last_built_time then
			return true
		end
	end

	if plugin_state.last_built_commit ~= current_commit then
		return true
	end

	if not plugin_state.build_success then
		return true
	end

	return false
end

---Execute build command for a plugin
---@param plugin Plugin
---@param plugin_dir string absolute path to plugin directory
---@return boolean success true if build succeeded
---@return string | nil commit current git commit hash
function M.execute(plugin, plugin_dir)
	local cmd = 'cd "' .. plugin_dir .. '" && ' .. plugin.build

	vim.notify('Building ' .. plugin.repo .. '...', vim.log.levels.INFO)
	local result = vim.fn.system(cmd)

	local current_commit = git.get_commit(plugin_dir)
	local success = vim.v.shell_error == 0

	if not success then
		vim.notify(
			'Build failed for ' .. plugin.repo .. ':\n' .. result,
			vim.log.levels.ERROR
		)
	end

	return success, current_commit
end

---Build all plugins that need building
---@param plugins Plugin[]
function M.build_all(plugins)
	local state = state_manager.read()

	for _, plugin in ipairs(plugins) do
		if plugin.build and plugin.name and registry.get(plugin.repo) == 'installed' then
			local plugin_dir = get_plugin_dir(plugin.name)

			if not M.needs_build(plugin.repo, plugin_dir, state) then
				goto continue
			end

			local success, commit = M.execute(plugin, plugin_dir)

			state[plugin.repo] = {
				last_built_commit = commit,
				last_built_time = os.time(),
				build_success = success,
			}

			local write_ok = state_manager.write(state)
			if not write_ok then
				vim.notify(
					'Failed to save build state for ' .. plugin.repo,
					vim.log.levels.WARN
				)
			end
		end

		::continue::
	end
end

return M
