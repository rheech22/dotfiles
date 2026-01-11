local Colors = require 'utils.colors'

local rainbow_hl = {
  'RainbowRed',
  'RainbowYellow',
  'RainbowBlue',
  'RainbowOrange',
  'RainbowGreen',
  'RainbowViolet',
  'RainbowCyan',
}
local rainbow_del_hl = {
  'RainbowDelimiterRed',
  'RainbowDelimiterYellow',
  'RainbowDelimiterBlue',
  'RainbowDelimiterOrange',
  'RainbowDelimiterGreen',
  'RainbowDelimiterViolet',
  'RainbowDelimiterCyan',
}

local base_pallette = {
  Red = '#e06c75',
  Yellow = '#e5c07b',
  Blue = '#61afef',
  Orange = '#d19a66',
  Green = '#98c379',
  Violet = '#c678dd',
  Cyan = '#56b6c2',
}

return {
  config = function()
    local hooks = require 'ibl.hooks'

    hooks.register(hooks.type.HIGHLIGHT_SETUP, function()
      local bg = Colors.get_bg()
      for name, color in pairs(base_pallette) do
        vim.api.nvim_set_hl(0, 'Rainbow' .. name, {
          fg = Colors.blend(color, bg, 0.85),
          bg = 'NONE',
          nocombine = true,
        })
        vim.api.nvim_set_hl(0, 'RainbowDelimiter' .. name, {
          fg = Colors.blend(color, bg, 0.55),
          bg = 'NONE',
          nocombine = true,
        })
      end
    end)

    hooks.register(hooks.type.SCOPE_HIGHLIGHT, hooks.builtin.scope_highlight_from_extmark)
    vim.g.rainbow_delimiters = { highlight = rainbow_del_hl }

    require('ibl').setup {
      indent = {
        highlight = rainbow_hl,
        char = '▏',
        tab_char = '▏',
      },
      scope = {
        highlight = rainbow_del_hl,
        char = '▏',
      },
    }
  end,
}
