local derive = require 'pack.scaffold.derive'
local concerns = require 'pack.concerns'
local query = require 'pack.query'

local M = {}

---@param repo string
---@param name string
---@param group 'plugins'|'lsps'
---@param concern string|nil
---@param create_config boolean
---@param deps string[]
---@return boolean, string|nil
function M.request(repo, name, group, concern, create_config, deps)
  if not concern or concern == '' then
    return false, 'Concern is required'
  end

  if not concerns.is_valid(concern) then
    return false, ('Unknown concern: %s'):format(concern)
  end

  for _, plugin in ipairs(query.list_declared()) do
    if plugin.repo == repo then
      return false, ('Repository already exists: %s'):format(repo)
    end
    if plugin.name == name then
      return false, ('Plugin name already exists: %s'):format(name)
    end
  end

  local spec_path = derive.spec_path(group)
  if vim.uv.fs_stat(spec_path) == nil then
    return false, ('Spec file not found: %s'):format(spec_path)
  end

  if create_config then
    local config_path = derive.config_path(group, name, concern)
    if vim.uv.fs_stat(config_path) ~= nil then
      return false, ('Config file already exists: %s'):format(config_path)
    end
  end

  local seen = {}
  for _, dep in ipairs(deps) do
    if dep == repo then
      return false, 'Dependency cannot be the same as the package repo'
    end
    if seen[dep] then
      return false, ('Duplicate dependency: %s'):format(dep)
    end
    seen[dep] = true
  end

  return true, nil
end

return M
