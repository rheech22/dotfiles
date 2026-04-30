local M = {}

M.names = {
  'appearance',
  'completion',
  'debug',
  'editing',
  'formatting',
  'git',
  'language',
  'navigation',
  'notes',
  'packages',
  'platform',
  'search',
  'tasks',
}

---@param concern string
---@return boolean
function M.is_valid(concern)
  return vim.tbl_contains(M.names, concern)
end

return M
