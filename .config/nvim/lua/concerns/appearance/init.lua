local M = {}

function M.pick_colorscheme()
  local themes = require 'concerns.appearance.setup.theme'
  local items = {}

  for _, theme in ipairs(themes.available_themes) do
    items[#items + 1] = { text = theme }
  end

  require('snacks').picker.pick {
    title = 'Colorscheme',
    items = items,
    format = 'text',
    preview = false,
    confirm = function(picker, item)
      picker:close()
      if item and item.text then
        themes.apply_theme(item.text)
      end
    end,
  }
end

return M
