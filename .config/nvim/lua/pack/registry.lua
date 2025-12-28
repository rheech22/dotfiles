---Plugin registry for tracking installation and configuration status
---In-memory state that tracks which plugins are installed/configured during session
require 'pack.types'

local M = {}

---@type PluginRegistry
local registry = {}

---Check if a plugin is registered
---@param repo string plugin repository name
---@return boolean
function M.is_registered(repo)
  return registry[repo] ~= nil
end

---Get plugin status
---@param repo string plugin repository name
---@return 'installed' | 'configured' | nil
function M.get(repo)
  return registry[repo]
end

---Set plugin status
---@param repo string plugin repository name
---@param status 'installed' | 'configured'
function M.set(repo, status)
  registry[repo] = status
end

---Clear all registry entries (useful for testing)
function M.clear()
  registry = {}
end

return M
