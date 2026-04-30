local overrides = require 'pack.overrides'

local M = {}

---@param plugin Plugin|string
---@return Plugin|string
local function apply_overrides(plugin)
  if type(plugin) == 'string' then
    return plugin
  end

  local copy = vim.tbl_deep_extend('force', {}, plugin)
  local enabled = overrides.get_enabled(copy.repo)
  if enabled ~= nil then
    copy.enabled = enabled
  end

  if copy.deps then
    copy.deps = vim.tbl_map(apply_overrides, copy.deps)
  end

  return copy
end

---@param group 'plugins'|'lsps'
---@return Plugin[]
function M.load(group)
  local plugins = require('pack.specs.' .. group)
  return vim.tbl_map(apply_overrides, plugins)
end

return M
