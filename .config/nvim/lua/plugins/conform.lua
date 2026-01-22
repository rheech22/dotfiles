local prettier_supported = {
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

local eslint_supported = {
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
}

local eslint_configs = {
  'eslint.config.js',
  'eslint.config.cjs',
  'eslint.config.mjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
}

return {
  config = function()
    local has_config = function(bufnr, configs)
      local bufname = vim.api.nvim_buf_get_name(bufnr)
      if bufname == '' then
        return false
      end
      local dir = vim.fs.dirname(bufname)
      return vim.fs.find(configs, { path = dir, upward = true })[1] ~= nil
    end
    local prettier_formatters_by = {}
    for _, ft in ipairs(prettier_supported) do
      prettier_formatters_by[ft] = { 'prettierd' }
    end
    local eslint_formatters_by = {}
    for _, ft in ipairs(eslint_supported) do
      eslint_formatters_by[ft] = function(bufnr)
        if has_config(bufnr, eslint_configs) then
          return { 'eslint_d' }
        end
        if has_config(bufnr, prettier_configs) then
          return { 'prettierd' }
        end
        return {}
      end
    end
    require('conform').setup {
      formatters_by_ft = vim.tbl_extend('keep', {
        lua = { 'stylua' },
        python = { 'ruff_format' },
        rust = { 'rustfmt', lsp_format = 'fallback' },
      }, eslint_formatters_by, prettier_formatters_by),
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
