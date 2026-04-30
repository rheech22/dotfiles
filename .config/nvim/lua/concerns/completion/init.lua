local M = {}

function M.ai_enabled()
  return vim.g.ai_cmp == true
end

return M
