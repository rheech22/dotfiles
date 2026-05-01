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
  if type(mode) == 'string' and #mode > 1 then
    local modes = {}
    for i = 1, #mode do
      modes[i] = mode:sub(i, i)
    end
    mode = modes
  end
  vim.keymap.set(mode, lhs, rhs, opts)
end

return M
