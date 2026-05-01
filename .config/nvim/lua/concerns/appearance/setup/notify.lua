return {
  config = function()
    local notify = require 'notify'

    local function get_bg()
      local ok, hl = pcall(vim.api.nvim_get_hl, 0, { name = 'Normal' })
      if ok and hl and hl.bg then
        return string.format('#%06x', hl.bg)
      end
      return '#000000'
    end

    notify.setup {
      background_colour = get_bg(),
      fps = 60,
      render = 'minimal',
      stages = 'fade',
      timeout = 1000,
      top_down = true,
    }

    vim.notify = notify

    vim.api.nvim_create_autocmd('ColorScheme', {
      callback = function()
        notify.setup { background_colour = get_bg() }
      end,
    })
  end,
}
