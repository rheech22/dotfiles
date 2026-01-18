return {
  config = function()
    require('smear_cursor').setup {}

    vim.api.nvim_create_autocmd('FileType', {
      pattern = { 'markdown', 'vimwiki' },
      callback = function()
        require('smear_cursor').enabled = false
      end,
    })
  end,
}
