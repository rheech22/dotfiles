require 'pack.types'

local paths = require 'pack.paths'
local build = require 'pack.build'
local pending = require 'pack.pending'
local remote = require 'pack.remote'
local specs = require 'pack.specs'
local registry = require 'pack.registry'
local state_manager = require 'pack.state'

local M = {}

---@class PackRuntimeInfo
---@field active boolean
---@field path string
---@field rev string|nil
---@field source_url string|nil
---@field requested_version string|nil
---@field branches string[]|nil
---@field tags string[]|nil

---@return table<string, PackRuntimeInfo>
local function runtime_info()
  local ok, plugins = pcall(vim.pack.get)
  if not ok then
    return {}
  end

  local info = {}
  for _, plugin in ipairs(plugins) do
    info[plugin.spec.name] = {
      active = plugin.active,
      path = plugin.path,
      rev = plugin.rev,
      source_url = plugin.spec.src,
      requested_version = plugin.spec.version,
      branches = plugin.branches,
      tags = plugin.tags,
    }
  end

  return info
end

---@param plugin Plugin|string
---@param group 'plugins'|'lsps'
---@param is_dependency boolean
---@return Plugin
local function normalize_entry(plugin, group, is_dependency)
  if type(plugin) == 'string' then
    return {
      repo = plugin,
      group = group,
      is_dependency = is_dependency,
    }
  end

  return vim.tbl_extend('force', plugin, {
    group = group,
    is_dependency = is_dependency,
  })
end

---@param entry Plugin
---@return Plugin
local function copy_entry(entry)
  return vim.tbl_deep_extend('force', {}, entry)
end

---@param plugin Plugin|string
---@param group 'plugins'|'lsps'
---@param is_dependency boolean
---@param items Plugin[]
---@param seen table<string, integer>
local function collect(plugin, group, is_dependency, items, seen)
  local entry = normalize_entry(plugin, group, is_dependency)
  local idx = seen[entry.repo]

  if not idx then
    items[#items + 1] = entry
    seen[entry.repo] = #items
  else
    local current = items[idx]
    if not current.name and entry.name then
      current.name = entry.name
    end
    if current.is_dependency and not entry.is_dependency then
      current.is_dependency = false
      current.group = entry.group
    end
  end

  for _, dep in ipairs(entry.deps or {}) do
    collect(dep, group, true, items, seen)
  end
end

---@return Plugin[]
local function declared_plugins()
  local items = {}
  local seen = {}

  for _, plugin in ipairs(specs.load 'plugins') do
    collect(plugin, 'plugins', false, items, seen)
  end

  for _, plugin in ipairs(specs.load 'lsps') do
    collect(plugin, 'lsps', false, items, seen)
  end

  return items
end

---@param plugin Plugin|string
---@param repo string
---@return boolean
local function depends_on(plugin, repo)
  if type(plugin) == 'string' then
    return plugin == repo
  end

  if plugin.repo == repo then
    return true
  end

  for _, dep in ipairs(plugin.deps or {}) do
    if depends_on(dep, repo) then
      return true
    end
  end

  return false
end

---@return { plugin: Plugin, group: 'plugins'|'lsps' }[]
local function top_level_specs()
  local items = {}

  for _, plugin in ipairs(specs.load 'plugins') do
    items[#items + 1] = { plugin = plugin, group = 'plugins' }
  end

  for _, plugin in ipairs(specs.load 'lsps') do
    items[#items + 1] = { plugin = plugin, group = 'lsps' }
  end

  return items
end

---@param repo string
---@return Plugin|nil
local function find_top_level_spec(repo)
  for _, entry in ipairs(top_level_specs()) do
    if type(entry.plugin) == 'table' and entry.plugin.repo == repo then
      return entry.plugin
    end
  end

  return nil
end

---@param repo string
---@param seen table<string, boolean>|nil
---@return string[]
local function dependency_chain_raw(repo, seen)
  local target = find_top_level_spec(repo)
  if not target or not target.deps then
    return {}
  end

  seen = seen or {}
  local chain = {}
  for _, dep in ipairs(target.deps) do
    local dep_repo = type(dep) == 'string' and dep or dep.repo
    if not seen[dep_repo] then
      seen[dep_repo] = true
      chain[#chain + 1] = dep_repo
      for _, nested in ipairs(dependency_chain_raw(dep_repo, seen)) do
        chain[#chain + 1] = nested
      end
    end
  end

  return chain
end

---@param repo string
---@return string[]
local function dependent_repos_raw(repo)
  local dependents = {}
  for _, entry in ipairs(top_level_specs()) do
    if type(entry.plugin) == 'table' and entry.plugin.repo ~= repo and depends_on(entry.plugin, repo) then
      dependents[#dependents + 1] = entry.plugin.repo
    end
  end

  table.sort(dependents)
  return dependents
end

---@param repo string
---@param seen table<string, boolean>|nil
---@return string[]
function M.dependency_chain(repo, seen)
  return dependency_chain_raw(repo, seen)
end

---@class OrphanPluginState
---@field name string
---@field path string
---@field active boolean
---@field current_rev string|nil
---@field source_url string|nil
---@field requested_version string|nil

---@return OrphanPluginState[]
function M.list_orphans()
  local ok, plugins = pcall(vim.pack.get)
  if not ok then
    return {}
  end

  local declared = {}
  for _, plugin in ipairs(M.list_declared()) do
    declared[paths.plugin_dir_name(plugin)] = true
  end

  local orphans = {}
  for _, plugin in ipairs(plugins) do
    local name = plugin.spec.name
    if not declared[name] then
      orphans[#orphans + 1] = {
        name = name,
        path = plugin.path,
        active = plugin.active,
        current_rev = plugin.rev,
        source_url = plugin.spec.src,
        requested_version = plugin.spec.version,
      }
    end
  end

  table.sort(orphans, function(a, b)
    return a.name < b.name
  end)

  return orphans
end

---@class ManagedPluginState: Plugin
---@field group 'plugins'|'lsps'
---@field is_dependency boolean
---@field enabled boolean
---@field installed_on_disk boolean
---@field configured boolean
---@field has_build boolean
---@field build_needed boolean
---@field config_path string|nil
---@field config_exists boolean
---@field plugin_dir string
---@field status 'installed'|'configured'|nil
---@field active boolean
---@field current_rev string|nil
---@field source_url string|nil
---@field requested_version string|nil
---@field remote_ref string|nil
---@field remote_rev string|nil
---@field update_available boolean|nil
---@field update_status 'unknown'|'available'|'latest'|'pinned'|'error'
---@field update_checked_at number|nil
---@field update_error string|nil
---@field build_last_built_commit string|nil
---@field build_last_built_time number|nil
---@field build_success boolean|nil
---@field dependency_chain string[]
---@field dependent_repos string[]
---@field pending_delete boolean

---@return ManagedPluginState[]
function M.list_declared()
  local build_state = state_manager.read()
  local pack_info = runtime_info()
  local remote_state = remote.read()

  return vim.tbl_map(function(plugin)
    local item = copy_entry(plugin)
    local plugin_dir = paths.plugin_dir(item)
    local config_path = paths.config_path(item.group, item)
    local status = registry.get(item.repo)
    local state = build_state[item.repo]

    item.enabled = item.enabled ~= false
    item.plugin_dir = plugin_dir
    item.config_path = config_path
    item.config_exists = config_path ~= nil and vim.uv.fs_stat(config_path) ~= nil or false
    item.installed_on_disk = vim.fn.isdirectory(plugin_dir) == 1
    item.configured = status == 'configured'
    item.status = status
    item.has_build = item.build ~= nil
    item.build_needed = item.has_build and build.needs_build(item.repo, plugin_dir, build_state) or false
    item.build_last_built_commit = state and state.last_built_commit or nil
    item.build_last_built_time = state and state.last_built_time or nil
    item.build_success = state and state.build_success or nil

    local pack_plugin = item.name and pack_info[item.name] or nil
    item.active = pack_plugin and pack_plugin.active or false
    item.current_rev = pack_plugin and pack_plugin.rev or nil
    item.source_url = pack_plugin and pack_plugin.source_url or nil
    item.requested_version = pack_plugin and pack_plugin.requested_version or item.version
    item.branches = pack_plugin and pack_plugin.branches or nil
    item.tags = pack_plugin and pack_plugin.tags or nil

    local remote_plugin = remote_state[item.repo]
    local remote_matches = remote_plugin
        and remote_plugin.current_rev == item.current_rev
        and remote_plugin.source_url == item.source_url
        and remote_plugin.requested_version == item.requested_version

    item.remote_ref = remote_matches and remote_plugin.remote_ref or nil
    item.remote_rev = remote_matches and remote_plugin.remote_rev or nil
    item.update_available = remote_matches and remote_plugin.update_available or nil
    item.update_status = remote_matches and remote_plugin.status or 'unknown'
    item.update_checked_at = remote_matches and remote_plugin.checked_at or nil
    item.update_error = remote_matches and remote_plugin.error or nil
    item.dependency_chain = dependency_chain_raw(item.repo)
    item.dependent_repos = dependent_repos_raw(item.repo)
    item.pending_delete = pending.has(item.name or paths.plugin_dir_name(item))

    return item
  end, declared_plugins())
end

---@return ManagedPluginState[]
function M.list_manageable()
  return vim.tbl_filter(function(plugin)
    return plugin.name ~= nil and not plugin.is_dependency
  end, M.list_declared())
end

---@param name_or_repo string
---@return ManagedPluginState|nil
function M.get_plugin_state(name_or_repo)
  for _, plugin in ipairs(M.list_declared()) do
    if plugin.repo == name_or_repo or plugin.name == name_or_repo then
      return plugin
    end
  end

  return nil
end

---@param name_or_repo string
---@return ManagedPluginState[]
function M.list_dependents(name_or_repo)
  local target = M.get_plugin_state(name_or_repo)
  if not target then
    return {}
  end

  local dependents = {}
  for _, entry in ipairs(top_level_specs()) do
    if type(entry.plugin) == 'table' and entry.plugin.repo ~= target.repo and depends_on(entry.plugin, target.repo) then
      local dependent = M.get_plugin_state(entry.plugin.repo)
      if dependent then
        dependents[#dependents + 1] = dependent
      end
    end
  end

  table.sort(dependents, function(a, b)
    return a.repo < b.repo
  end)

  return dependents
end

return M
