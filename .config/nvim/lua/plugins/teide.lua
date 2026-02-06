return {
  config = function()
    vim.cmd 'colorscheme teide-darker'
    vim.cmd 'colorscheme catppuccin'
    vim.cmd 'colorscheme vague'
    require('vague').setup {
      -- transparent = true,
    }
  end,
}
