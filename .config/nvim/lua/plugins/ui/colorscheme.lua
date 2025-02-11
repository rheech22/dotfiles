return {
  {
    'scottmckendry/cyberdream.nvim',
    lazy = false,
    priority = 1000,
    config = function()
      require('cyberdream').setup {
        transparent = true,
        italic_comments = true,
        borderless_picker = false,
      }
      vim.cmd [[colorscheme cyberdream]]
      -- Neo Tree Colors
      vim.api.nvim_set_hl(0, 'NeoTreeDirectoryIcon', { fg = '#813159' })
      vim.api.nvim_set_hl(0, 'NeoTreeDirectoryName', { fg = '#AB8E9D' })
      -- Snacks Dashboard Colors
      vim.api.nvim_set_hl(0, 'SnacksDashboardIcon', { fg = '#813159' })
      vim.api.nvim_set_hl(0, 'SnacksDashboardDesc', { fg = '#AB8E9D' })
      -- Mini Statusline Colors
      vim.api.nvim_set_hl(0, 'MiniStatuslineModeNormal', { bg = '#813159' })
      vim.api.nvim_set_hl(0, 'MiniStatuslineModeVisual', { bg = '#e05f75' })
      vim.api.nvim_set_hl(0, 'MiniStatuslineModeInsert', { bg = '#788a0b' })
    end,
  },
}
