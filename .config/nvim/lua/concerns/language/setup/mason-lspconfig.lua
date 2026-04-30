return {
  config = function()
    require('mason-lspconfig').setup {
      ensure_installed = {
        'lua_ls',
        'tailwindcss',
        'cssls',
        'astro',
        'eslint',
        'basedpyright',
        'ruff',
        'rust_analyzer',
      },
      automatic_enable = true,
    }
  end,
}
