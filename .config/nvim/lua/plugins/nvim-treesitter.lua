return {
  config = function()
    require('nvim-treesitter.configs').setup {
      ensure_installed = { 'lua', 'vim', 'vimdoc', 'markdown', 'markdown_inline', 'css', 'styled' },
      sync_install = false,
      auto_install = true,
      ignore_install = {},
      highlight = {
        enable = true,
        additional_vim_regex_highlighting = false,
      },
    }

    vim.treesitter.language.register('markdown', 'vimwiki')
  end,
}
