---Build state file management
---Handles persistent storage of plugin build information
require 'pack.types'

local M = {}

---@type string
local STATE_FILE = vim.fn.stdpath 'data' .. '/plugin-build-state.json'

---Read build state from file
---@return BuildStateMap
function M.read()
  local file = io.open(STATE_FILE, 'r')
  if not file then
    return {}
  end
  local content = file:read '*a'
  file:close()

  local ok, state = pcall(vim.json.decode, content)
  if not ok or type(state) ~= 'table' then
    return {}
  end

  return state
end

---Write build state to file
---@param state BuildStateMap
---@return boolean success
function M.write(state)
  local ok, json = pcall(vim.json.encode, state)
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

return M
