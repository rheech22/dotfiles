local M = {}

---@param key string
---@return string
function M.leader(key)
  return '<leader>' .. key
end

---@param cmd string
---@return string
function M.cmd(cmd)
  return '<Cmd>' .. cmd .. '<CR>'
end

---@param mode string|string[]
---@param lhs string
---@param rhs string|function
---@param desc string
---@param opts table|nil
function M.map(mode, lhs, rhs, desc, opts)
  opts = opts or {}
  opts.desc = desc
  vim.keymap.set(mode, lhs, rhs, opts)
end

return M
