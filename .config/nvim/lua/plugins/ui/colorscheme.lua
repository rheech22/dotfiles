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
  {
    'alexxGmZ/e-ink.nvim',
    priority = 2000,
    config = function()
      require('e-ink').setup()
      vim.opt.background = 'light'
    end,
  },
  {
    'zaldih/themery.nvim',
    lazy = false,
    config = function()
      require('themery').setup {
        themes = {
          {
            name = 'Coding',
            colorscheme = 'cyberdream',
          },
          {
            name = 'Reading',
            colorscheme = 'e-ink',
          },
        },
        vim.keymap.set('n', '<leader>uu', function()
          local themery = require 'themery'
          local currentTheme = themery.getCurrentTheme()
          if currentTheme and currentTheme.name == 'Coding' then
            themery.setThemeByName('Reading', true)
          else
            themery.setThemeByName('Coding', true)
          end
        end, { noremap = true }),
      }
    end,
  },
}
