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
      },
      automatic_enable = true,
    }
  end,
}
