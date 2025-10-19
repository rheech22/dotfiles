return {
  config = function()
    require('supermaven-nvim').setup {
      keymaps = {
        accept_word = '<C-j>',
        accept_suggestion = '<C-s>',
        clear_suggestion = '<C-]>',
      },
      color = {
        suggestion_color = '#ffffff',
      },
      ignore_filetypes = { 'markdown', 'mdx', 'vimwiki', 'codecompanion' },
    }
  end,
}
