return {
  config = function()
    local notify = require 'notify'

    notify.setup {
      background_colour = '#000000',
      fps = 60,
      render = 'compact',
      stages = 'fade_in_slide_out',
      timeout = 2500,
      top_down = true,
    }

    vim.notify = notify
  end,
}
