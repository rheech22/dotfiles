local M = {}

---@class Plugin
---@field repo string {repo} github repository name
---@field name string | nil  {name} filename for plugin setup in {setup_dir}
---@field deps (Plugin|string)[] | nil
---@field version string | nil  {version} git brnach, tag, or commit hash
---@field build string | nil  {build} shell command to run in plugin directory after install

---@class InstallerParams
---@field plugins (Plugin|string)[]  plugins to install
---@field setup_dir string  directory to locate plugin setup files

---registry to prevent installing same plugin twice
---@type table<string, 'installed' | 'configured'>
local plugin_registry = {}

---format to vim.pack.Spec
---@param plugins Plugin[]
---@return vim.pack.Spec[]
local function _spec(plugins)
	return vim.tbl_map(function(plugin)
		return {
			name = plugin.name,
			version = plugin.version,
			src = 'https://github.com/' .. plugin.repo,
		}
	end, plugins)
end

---install plugins
---@param plugins Plugin[]
local function _install(plugins)
	local will_be_installed = {}
	for _, plugin in ipairs(plugins) do
		if not plugin_registry[plugin.repo] then
			table.insert(will_be_installed, plugin)
			plugin_registry[plugin.repo] = 'installed'
		end
	end
	vim.pack.add(_spec(will_be_installed), { confirm = false })
end

---load setup file for plugin
---@param dir string
---@param plugin_name string
---@return table | nil
local function _setup(dir, plugin_name)
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

---check if plugin is already built
---@param plugin_dir string
---@param build_cmd string
---@return boolean
local function _is_built(plugin_dir, build_cmd)
	-- Check for common build artifacts
	if build_cmd:match('cargo') then
		return vim.fn.isdirectory(plugin_dir .. '/target/release') == 1
	elseif build_cmd:match('npm') or build_cmd:match('yarn') then
		return vim.fn.isdirectory(plugin_dir .. '/node_modules') == 1
	end
	-- Default: assume not built
	return false
end

---build plugins that have build command
---@param plugins Plugin[]
local function _build(plugins)
	for _, plugin in ipairs(plugins) do
		if plugin.build and plugin.name and plugin_registry[plugin.repo] == 'installed' then
			local plugin_dir = vim.fn.stdpath('data') .. '/site/pack/core/opt/' .. plugin.name

			-- Skip if already built
			if _is_built(plugin_dir, plugin.build) then
				goto continue
			end

			local cmd = 'cd "' .. plugin_dir .. '" && ' .. plugin.build

			vim.notify('Building ' .. plugin.repo .. '...', vim.log.levels.INFO)
			local result = vim.fn.system(cmd)

			if vim.v.shell_error ~= 0 then
				vim.notify(
					'Build failed for ' .. plugin.repo .. ':\n' .. result,
					vim.log.levels.ERROR
				)
			end

			::continue::
		end
	end
end

---call cofig function for plugins
---@param dir string
---@param plugins Plugin[]
local function _setups(dir, plugins)
	for _, plugin in ipairs(plugins) do
		if not plugin.name then
			return
		end
		if plugin_registry[plugin.repo] == 'installed' then
			local setup = _setup(dir, plugin.name)
			if setup and setup.config then
				local ok, err = pcall(setup.config)
				if ok then
					plugin_registry[plugin.repo] = 'configured'
				else
					vim.notify(
						'Config failed for ' .. plugin.repo .. ':\n' .. tostring(err),
						vim.log.levels.ERROR
					)
				end
			end
		end
	end
end

---parse to plugin table
---@param plugins (Plugin|string)[]
---@return Plugin[]
local function _plugins(plugins)
	return vim.tbl_map(function(plugin)
		if type(plugin) == 'string' then
			return { repo = plugin }
		end
		return plugin
	end, plugins)
end

---extract dependencies from plugins
---@param plugins Plugin[]
---@return (Plugin|string)[]
local function _deps(plugins)
	local deps = {}
	for _, plugin in ipairs(plugins) do
		if plugin.deps and #plugin.deps > 0 then
			for _, dep in ipairs(plugin.deps) do
				table.insert(deps, dep)
			end
		end
	end
	return deps
end

---install plugins and call config function for plugins
---@param params InstallerParams  params for installer {plugins} and {setup_dir}
function M.install(params)
	local dir = params.setup_dir
	local plugins = _plugins(params.plugins)

	local deps = _plugins(_deps(plugins))
	if #deps > 0 then
		_install(deps)
		_build(deps)
		_setups(dir, deps)
	end

	_install(plugins)
	_build(plugins)
	_setups(dir, plugins)
end

return M
