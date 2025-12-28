---Main plugin manager orchestration
---Public API for installing and configuring plugins
require 'pack.types'
local install = require 'pack.install'
local build = require 'pack.build'
local setup = require 'pack.setup'

local M = {}

---Normalize plugin entries to Plugin objects
---@param plugins (Plugin|string)[]
---@return Plugin[]
local function normalize_plugins(plugins)
  return vim.tbl_map(function(plugin)
    if type(plugin) == 'string' then
      return { repo = plugin }
    end
    return plugin
  end, plugins)
end

---Extract dependencies from plugins
---@param plugins Plugin[]
---@return Plugin[]
local function extract_deps(plugins)
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

---Install plugins and their dependencies, then build and configure them
---@param params InstallerParams
function M.install(params)
  local dir = params.setup_dir
  local plugins = normalize_plugins(params.plugins)

  -- Process dependencies first
  local raw_deps = extract_deps(plugins)
  if #raw_deps > 0 then
    local deps = normalize_plugins(raw_deps)
    install.install_all(deps)
    build.build_all(deps)
    setup.configure_all(dir, deps)
  end

  -- Process main plugins
  install.install_all(plugins)
  build.build_all(plugins)
  setup.configure_all(dir, plugins)
end

return M
