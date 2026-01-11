return {
  config = function()
    require('colorful-winsep').setup {
      -- https://github.com/nvim-zh/colorful-winsep.nvim
      border = 'double',
      excluded_ft = { 'mason' },
      animate = {
        -- NOTE: progressive option doesn't work well, check below
        -- https://github.com/nvim-zh/colorful-winsep.nvim/issues/107
        enabled = 'shift',
      },
    }
    vim.api.nvim_set_hl(0, 'ColorfulWinSep', { fg = '#e8b589', bg = 'black' })
  end,
}
