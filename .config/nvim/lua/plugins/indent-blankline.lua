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

local base = Colors.palette()
local pallette = {
  Red = base.red,
  Yellow = base.yellow,
  Blue = base.blue,
  Orange = base.orange,
  Green = base.green,
  Violet = base.violet,
  Cyan = base.cyan,
}

return {
  config = function()
    local hooks = require 'ibl.hooks'

    hooks.register(hooks.type.HIGHLIGHT_SETUP, function()
      for name, color in pairs(pallette) do
        vim.api.nvim_set_hl(0, 'Rainbow' .. name, {
          fg = Colors.blend(color, base.bg, 0.85),
          bg = 'NONE',
          nocombine = true,
        })
        vim.api.nvim_set_hl(0, 'RainbowDelimiter' .. name, {
          fg = Colors.blend(color, base.bg, 0.55),
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
      exclude = { filetypes = { 'dashboard', 'vimwiki', 'markdown', 'text' } },
    }
  end,
}
