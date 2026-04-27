return {
  config = function()
    require('snacks').setup {
      gh = { enabled = true },
      input = { enabled = true },
      picker = {
        enabled = true,
        sources = {
          gh_diff = {
            auto_close = false,
            layout = {
              preset = 'right',
              -- hidden = { 'preview' },
            },
          },
        },
      },
      terminal = { enabled = true },
      bigfile = { enabled = false },
      dashboard = { enabled = false },
      dim = { enabled = false },
      explorer = { enabled = false },
      indent = { enabled = false },
      notifier = { enabled = false },
      quickfile = { enabled = false },
      scope = { enabled = false },
      scroll = { enabled = false },
      statuscolumn = { enabled = false },
      words = { enabled = false },
      zen = { enabled = false },
      image = {
        enabled = true,
      },
      styles = {
        terminal_right = {
          bo = { filetype = 'snacks_terminal' },
          wo = {},
          position = 'right',
          width = 0.4,
        },
        terminal_bottom = {
          bo = { filetype = 'snacks_terminal' },
          wo = {},
          position = 'bottom',
          height = 0.3,
        },
      },
    }
  end,
}
