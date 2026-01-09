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

local prettier_configs = {
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.json5',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.toml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
}

return {
  config = function()
    local prettier_formatters_by = {}
    for _, ft in ipairs(prettier_supported) do
      prettier_formatters_by[ft] = { 'prettierd' }
    end
    require('conform').setup {
      formatters_by_ft = vim.tbl_extend('keep', {
        lua = { 'stylua' },
        python = { 'ruff_format' },
      }, prettier_formatters_by),
      format_on_save = {
        timeout_ms = 500,
        lsp_fallback = 'fallback',
      },
      formatters = {
        prettierd = {
          require_cwd = true,
          cwd = require('conform.util').root_file(prettier_configs),
        },
      },
    }
  end,
}
