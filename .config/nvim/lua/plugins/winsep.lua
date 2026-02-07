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
  end,
}
