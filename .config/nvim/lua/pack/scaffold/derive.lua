local paths = require 'pack.paths'

local M = {}

local alias_overrides = {
  ['blink.cmp'] = 'blink',
  ['colorful-winsep'] = 'winsep',
  ['nvim-dap'] = 'dap',
}

---@param repo string
---@return string
local function repo_tail(repo)
  return repo:match '/([^/]+)$' or repo
end

---@param repo string
---@return string
function M.name(repo)
  local name = repo_tail(repo)
  name = name:gsub('%.git$', '')

  if alias_overrides[name] then
    return alias_overrides[name]
  end

  name = name:gsub('%.n?vim$', '')
  name = name:gsub('%.cmp$', '')
  name = name:gsub('%.lua$', '')

  if name:match '^nvim%-.+' and not vim.tbl_contains({ 'nvim-treesitter', 'nvim-lspconfig' }, name) then
    name = name:gsub('^nvim%-', '')
  end

  return name
end

---@param group 'plugins'|'lsps'
---@return string
function M.spec_path(group)
  return paths.spec_path(group)
end

---@param group 'plugins'|'lsps'
---@param name string
---@param concern string|nil
---@return string
function M.config_path(group, name, concern)
  if concern and concern ~= '' then
    return paths.concern_setup_dir(concern) .. name .. '.lua'
  end

  return paths.setup_dir(group) .. name .. '.lua'
end

return M
