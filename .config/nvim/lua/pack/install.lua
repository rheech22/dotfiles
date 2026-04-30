---Plugin installation module
---Handles downloading and installing plugins via vim.pack.add
require 'pack.types'
local paths = require 'pack.paths'
local registry = require 'pack.registry'

local M = {}

---Convert Plugin objects to vim.pack.Spec format
---@param plugins Plugin[]
---@return vim.pack.Spec[]
function M.to_spec(plugins)
  return vim.tbl_map(function(plugin)
    return {
      name = plugin.name,
      version = plugin.version,
      src = paths.source_url(plugin),
    }
  end, plugins)
end

---Install plugins that are not already registered
---@param plugins Plugin[]
function M.install_all(plugins)
  local will_be_installed = {}
  for _, plugin in ipairs(plugins) do
    if not registry.is_registered(plugin.repo) then
      table.insert(will_be_installed, plugin)
    end
  end

  if #will_be_installed > 0 then
    local ok, err = pcall(vim.pack.add, M.to_spec(will_be_installed), { confirm = false })
    if not ok then
      vim.notify('Install failed:\n' .. tostring(err), vim.log.levels.ERROR)
      return
    end

    for _, plugin in ipairs(will_be_installed) do
      registry.set(plugin.repo, 'installed')
    end
  end
end

return M
