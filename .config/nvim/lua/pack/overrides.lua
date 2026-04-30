local M = {}

local STATE_FILE = vim.fn.stdpath 'state' .. '/pack-overrides.json'

---@class PackOverrides
---@field enabled table<string, boolean>

---@return PackOverrides
function M.read()
  local file = io.open(STATE_FILE, 'r')
  if not file then
    return { enabled = {} }
  end

  local content = file:read '*a'
  file:close()

  local ok, decoded = pcall(vim.json.decode, content)
  if not ok or type(decoded) ~= 'table' then
    return { enabled = {} }
  end

  decoded.enabled = type(decoded.enabled) == 'table' and decoded.enabled or {}
  return decoded
end

---@param overrides PackOverrides
---@return boolean
function M.write(overrides)
  vim.fn.mkdir(vim.fn.fnamemodify(STATE_FILE, ':h'), 'p')

  local ok, json = pcall(vim.json.encode, overrides)
  if not ok then
    return false
  end

  local file = io.open(STATE_FILE, 'w')
  if not file then
    return false
  end

  file:write(json)
  file:close()
  return true
end

---@param repo string
---@return boolean|nil
function M.get_enabled(repo)
  return M.read().enabled[repo]
end

---@param repo string
---@param enabled boolean|nil
---@return boolean
function M.set_enabled(repo, enabled)
  local overrides = M.read()
  if enabled == nil then
    overrides.enabled[repo] = nil
  else
    overrides.enabled[repo] = enabled
  end

  return M.write(overrides)
end

---@param repo string
---@return boolean
function M.clear_repo(repo)
  return M.set_enabled(repo, nil)
end

return M
