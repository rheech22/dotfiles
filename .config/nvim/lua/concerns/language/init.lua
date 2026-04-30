local M = {}

function M.rename_symbol()
  vim.lsp.buf.rename()
end

function M.rename_file()
  require('snacks').rename.rename_file()
end

function M.code_action()
  vim.lsp.buf.code_action()
end

function M.definition()
  vim.lsp.buf.definition()
end

function M.diagnostics_float()
  vim.diagnostic.open_float()
end

function M.diagnostic_next()
  vim.diagnostic.jump { count = 1, float = true }
end

function M.diagnostic_prev()
  vim.diagnostic.jump { count = -1, float = true }
end

return M
