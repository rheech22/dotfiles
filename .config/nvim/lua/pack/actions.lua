require 'pack.types'

local build = require 'pack.build'
local overrides = require 'pack.overrides'
local paths = require 'pack.paths'
local pending = require 'pack.pending'
local query = require 'pack.query'
local remote = require 'pack.remote'
local registry = require 'pack.registry'
local spec_write = require 'pack.scaffold.write'
local state_manager = require 'pack.state'

local M = {}

---@param name_or_repo string
---@return ManagedPluginState
local function resolve(name_or_repo)
  local plugin = query.get_plugin_state(name_or_repo)
  if not plugin then
    error(('Unknown plugin: %s'):format(name_or_repo))
  end

  return plugin
end

---@param plugin ManagedPluginState
---@return string
local function pack_name(plugin)
  return paths.plugin_dir_name(plugin)
end

---@param name_or_repo string
function M.update(name_or_repo)
  local plugin = resolve(name_or_repo)
  vim.pack.update({ pack_name(plugin) }, { force = true })
end

---@param name_or_repo string
function M.rebuild(name_or_repo)
  local plugin = resolve(name_or_repo)
  if not plugin.build then
    vim.notify(('No build step for %s'):format(plugin.repo), vim.log.levels.WARN)
    return
  end

  local state = state_manager.read()
  local success, commit = build.execute(plugin, plugin.plugin_dir)
  state[plugin.repo] = {
    last_built_commit = commit,
    last_built_time = os.time(),
    build_success = success,
  }
  state_manager.write(state)
end

---@param name_or_repo string
function M.open_config(name_or_repo)
  local plugin = resolve(name_or_repo)
  if not plugin.config_exists or not plugin.config_path then
    vim.notify(('No config file for %s'):format(plugin.repo), vim.log.levels.WARN)
    return
  end

  vim.cmd('edit ' .. vim.fn.fnameescape(plugin.config_path))
end

---@param name_or_repo string
function M.open_plugin_dir(name_or_repo)
  local plugin = resolve(name_or_repo)
  vim.cmd('edit ' .. vim.fn.fnameescape(plugin.plugin_dir))
end

---@param name_or_repo string
function M.enable(name_or_repo)
  local plugin = resolve(name_or_repo)
  if overrides.set_enabled(plugin.repo, true) then
    vim.notify(('Enabled %s. Restart Neovim to apply.'):format(plugin.repo), vim.log.levels.INFO)
  else
    vim.notify(('Failed to enable %s'):format(plugin.repo), vim.log.levels.ERROR)
  end
end

---@param name_or_repo string
function M.disable(name_or_repo)
  local plugin = resolve(name_or_repo)
  if overrides.set_enabled(plugin.repo, false) then
    vim.notify(('Disabled %s. Restart Neovim to apply.'):format(plugin.repo), vim.log.levels.INFO)
  else
    vim.notify(('Failed to disable %s'):format(plugin.repo), vim.log.levels.ERROR)
  end
end

---@param name_or_repo string
function M.check_update(name_or_repo)
  local plugin = resolve(name_or_repo)
  local result = remote.check_and_store(plugin)
  if result.status == 'available' then
    vim.notify(('Update available for %s (%s -> %s)'):format(plugin.repo, plugin.current_rev:sub(1, 7), result.remote_rev:sub(1, 7)), vim.log.levels.INFO)
  elseif result.status == 'latest' then
    vim.notify(('Already up to date: %s'):format(plugin.repo), vim.log.levels.INFO)
  elseif result.status == 'pinned' then
    vim.notify(('Pinned version, skipping remote comparison: %s'):format(plugin.repo), vim.log.levels.INFO)
  else
    vim.notify(('Failed to check updates for %s: %s'):format(plugin.repo, result.error or 'unknown error'), vim.log.levels.WARN)
  end
end

function M.check_all_updates()
  local plugins = query.list_manageable()
  remote.check_all_and_store(plugins)
  vim.notify(('Checked updates for %d packages'):format(#plugins), vim.log.levels.INFO)
end

---@param name_or_repo string
---@return boolean, string|nil
function M.remove(name_or_repo)
  local plugin = resolve(name_or_repo)
  if plugin.is_dependency then
    return false, ('Cannot remove %s directly. It is only declared as a dependency.'):format(plugin.repo)
  end

  local dependents = query.list_dependents(plugin.repo)
  if #dependents > 0 then
    local names = vim.tbl_map(function(item)
      return item.name or item.repo
    end, dependents)
    return false, ('Cannot remove %s. Used by: %s'):format(plugin.repo, table.concat(names, ', '))
  end

  local spec_err = spec_write.remove_spec(plugin.group, plugin.repo)
  if spec_err then
    return false, spec_err
  end

  if plugin.config_path and vim.fn.filereadable(plugin.config_path) == 1 then
    vim.fn.delete(plugin.config_path)
  end

  overrides.clear_repo(plugin.repo)
  remote.clear_repo(plugin.repo)
  state_manager.clear_repo(plugin.repo)
  registry.clear_repo(plugin.repo)

  pending.add(pack_name(plugin), {
    repo = plugin.repo,
    group = plugin.group,
    requested_at = os.time(),
    is_orphan = false,
    plugin_dir = plugin.plugin_dir,
  })

  vim.notify(('Removed %s. Restarting to finalize...'):format(plugin.repo), vim.log.levels.INFO)
  vim.cmd.restart()

  return true, nil
end

---@param name string
---@return boolean, string|nil
function M.delete_orphan(name)
  local ok, err = pcall(vim.pack.del, { name }, { force = false })
  if ok then
    vim.notify(('Deleted orphan %s'):format(name), vim.log.levels.INFO)
  else
    vim.notify(('Failed to delete orphan %s: %s'):format(name, err), vim.log.levels.WARN)
  end
  return ok, err
end

return M
