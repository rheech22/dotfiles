local prettier_supported = {
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'css',
  'scss',
  'graphql',
  'html',
  'json',
  'jsonc',
  'yaml',
}

return {
  config = function()
    local prettier_formatters_by = {}
    for _, ft in ipairs(prettier_supported) do
      prettier_formatters_by[ft] = { 'prettier' }
    end
    require('conform').setup {
      formatters_by_ft = vim.tbl_extend('keep', {
        lua = { 'stylua' },
      }, prettier_formatters_by),
      format_on_save = {
        timeout_ms = 500,
        lsp_fallback = 'fallback',
      },
    }
  end,
}
