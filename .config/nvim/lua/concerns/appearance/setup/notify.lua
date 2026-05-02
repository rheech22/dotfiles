return {
  config = function()
    local notify = require 'notify'
    local palettes = require 'utils.theme-colors'
    local theme_file = vim.fn.expand '~/.local/state/dotfiles/theme.txt'

    notify.setup {
      background_colour = function()
        local f = io.open(theme_file, 'r')
        local name = f and (f:read('*all'):gsub('%s+', '')) or 'vague'
        if f then f:close() end
        local p = palettes[name] or palettes.vague
        return p.bg
      end,
      fps = 60,
      render = 'minimal',
      stages = 'fade',
      timeout = 1000,
      top_down = true,
    }

    vim.notify = notify

    pcall(vim.api.nvim_del_augroup_by_name, 'NvimNotifyRefreshHighlights')
  end,
}
