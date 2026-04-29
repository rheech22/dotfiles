return {
  config = function()
    require('snacks').setup {
      gh = { enabled = true },
      input = { enabled = true },
      lazygit = { enabled = true },
      picker = {
        enabled = true,
        ui_select = true,
        layout = {
          preset = 'ivy',
          fullscreen = true,
        },
        previewers = {
          diff = {
            style = 'fancy',
          },
        },
        sources = {
          git_diff = {
            layout = {
              preset = 'ivy',
              fullscreen = true,
            },
          },
          gh_diff = {
            auto_close = false,
            layout = {
              preset = 'left',
              -- hidden = { 'preview' },
            },
          },
          lsp_references = {
            layout = {
              preset = 'ivy',
              fullscreen = false,
            },
          },
          lsp_symbols = {
            layout = {
              preset = 'ivy',
              fullscreen = false,
            },
          },
          lsp_workspace_symbols = {
            layout = {
              preset = 'ivy',
              fullscreen = true,
            },
          },
        },
      },
      rename = { enabled = true },
      scroll = {
        enabled = true,
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
      statuscolumn = { enabled = false },
      words = {
        enabled = true,
        debounce = 200,
        notify_end = false,
      },
      zen = {
        enabled = true,
        win = {
          backdrop = { transparent = false, blend = 75 },
          width = 130,
          height = 0,
        },
      },
      image = {
        enabled = false,
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
