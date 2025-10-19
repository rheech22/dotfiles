return {
  config = function()
    require('markview').setup {
      preview = {
        icon_provider = 'mini',
        filetypes = {
          'markdown',
          'vimwiki',
          'codecompanion',
        },
        ignore_buftypes = {},
      },
    }

    vim.api.nvim_create_autocmd('FileType', {
      pattern = 'codecompanion',
      command = 'Markview attach',
    })
  end,
}
