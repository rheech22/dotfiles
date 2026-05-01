local M = {}

function M.format_buffer()
  local bufnr = vim.api.nvim_get_current_buf()
  local eslint_client = vim.lsp.get_clients { bufnr = bufnr, name = 'eslint' }[1]
  if eslint_client then
    vim.cmd 'LspEslintFixAll'
  else
    vim.lsp.buf.format { async = true }
  end
  vim.notify('Formatted', vim.log.levels.INFO)
end

return M
