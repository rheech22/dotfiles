-- NOTE: this plugins is not used currently since it is not maintained these days.
return {
  config = function()
    require('supermaven-nvim').setup {
      keymaps = {
        accept_word = '<C-k>',
        accept_suggestion = '<C-;>',
        clear_suggestion = '<C-]>',
      },
      color = {
        suggestion_color = '#ffffff',
      },
      ignore_filetypes = { 'markdown', 'mdx', 'vimwiki', 'codecompanion' },
    }
  end,
}
