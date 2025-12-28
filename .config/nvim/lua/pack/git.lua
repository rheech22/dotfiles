---Git utility functions
---Handles git operations for plugin management

local M = {}

---Get current git commit hash for a plugin
---@param plugin_dir string absolute path to plugin directory
---@return string | nil commit_hash nil if not a git repo or error
function M.get_commit(plugin_dir)
  local cmd = 'cd "' .. plugin_dir .. '" && git rev-parse HEAD 2>/dev/null'
  local commit = vim.fn.system(cmd)
  if vim.v.shell_error ~= 0 then
    return nil
  end
  return vim.trim(commit)
end

---Get directory birth time (creation time)
---Used to detect if plugin was deleted and reinstalled
---@param plugin_dir string absolute path to plugin directory
---@return number | nil birth_time unix timestamp, nil if error
function M.get_dir_birth_time(plugin_dir)
  -- macOS uses -f "%B", Linux uses -c "%W"
  local cmd = 'stat -f "%B" "' .. plugin_dir .. '" 2>/dev/null || stat -c "%W" "' .. plugin_dir .. '" 2>/dev/null'
  local result = vim.fn.system(cmd)
  if vim.v.shell_error ~= 0 then
    return nil
  end
  return tonumber(vim.trim(result))
end

return M
