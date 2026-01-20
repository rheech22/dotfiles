return {
  config = function()
    require('colorful-winsep').setup {
      -- https://github.com/nvim-zh/colorful-winsep.nvim
      border = 'rounded',
      excluded_ft = { 'mason' },
      animate = {
        -- NOTE: progressive option doesn't work well, check below
        -- https://github.com/nvim-zh/colorful-winsep.nvim/issues/107
        enabled = 'shift',
      },
    }
    vim.api.nvim_set_hl(0, 'ColorfulWinSep', { fg = '#00FF00', bg = 'black' })
  end,
}
