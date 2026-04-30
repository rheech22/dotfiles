local M = {}

---@param repo string
---@return string
local function repo_tail(repo)
  return (repo:match '/([^/]+)$' or repo):gsub('%.git$', '')
end

---@param plugin Plugin|string
---@return string
function M.plugin_dir_name(plugin)
  if type(plugin) == 'string' then
    return repo_tail(plugin)
  end

  return plugin.name or repo_tail(plugin.repo)
end

---@param plugin Plugin|string
---@return string
function M.plugin_dir(plugin)
  return M.pack_dir() .. '/' .. M.plugin_dir_name(plugin)
end

---@return string
function M.pack_dir()
  return vim.fn.stdpath('data') .. '/site/pack/core/opt'
end

---@param plugin Plugin
---@return string
function M.source_url(plugin)
  return (plugin.provider_host or 'https://github.com') .. '/' .. plugin.repo
end

---@param group 'plugins'|'lsps'
---@return string
function M.spec_path(group)
  return vim.fn.stdpath('config') .. '/lua/pack/specs/' .. group .. '.lua'
end

---@param group 'plugins'|'lsps'
---@return string
function M.setup_dir(group)
  return vim.fn.stdpath('config') .. '/lua/' .. group .. '/'
end

---@param concern string
---@return string
function M.concern_setup_dir(concern)
  return vim.fn.stdpath('config') .. '/lua/concerns/' .. concern .. '/setup/'
end

---@param plugin Plugin
---@return string|nil
function M.setup_path(plugin)
  local setup_name = plugin.config or plugin.name
  if not setup_name or not plugin.concern then
    return nil
  end

  return M.concern_setup_dir(plugin.concern) .. setup_name .. '.lua'
end

---@param group 'plugins'|'lsps'
---@param plugin Plugin
---@return string|nil
function M.config_path(group, plugin)
  local setup_path = M.setup_path(plugin)
  if setup_path then
    return setup_path
  end

  local config_name = plugin.config or plugin.name
  if not config_name then
    return nil
  end

  return M.setup_dir(group) .. config_name .. '.lua'
end

return M
