require 'pack.types'

local M = {}

local STATE_FILE = vim.fn.stdpath('data') .. '/pack-pending-deletions.json'

---@type table<string, PendingDeletion>|nil
local cache = nil

local function ensure_loaded()
  if cache ~= nil then
    return
  end

  local file = io.open(STATE_FILE, 'r')
  if not file then
    cache = {}
    return
  end

  local content = file:read('*a')
  file:close()

  local ok, state = pcall(vim.json.decode, content)
  if not ok or type(state) ~= 'table' then
    cache = {}
    return
  end

  cache = state
end

local function flush()
  if cache == nil then
    return
  end

  local ok, json = pcall(vim.json.encode, cache)
  if not ok then
    return
  end

  local dir = vim.fn.fnamemodify(STATE_FILE, ':h')
  vim.fn.mkdir(dir, 'p')

  local file = io.open(STATE_FILE, 'w')
  if not file then
    return
  end

  file:write(json)
  file:close()
end

---@return table<string, PendingDeletion>
function M.list()
  ensure_loaded()
  return cache
end

---@param name string
---@return boolean
function M.has(name)
  ensure_loaded()
  return cache[name] ~= nil
end

---@param name string
---@param entry PendingDeletion
function M.add(name, entry)
  ensure_loaded()
  cache[name] = entry
  flush()
end

---@param name string
function M.remove(name)
  ensure_loaded()
  cache[name] = nil
  flush()
end

function M.clear()
  cache = {}
  flush()
end

return M
