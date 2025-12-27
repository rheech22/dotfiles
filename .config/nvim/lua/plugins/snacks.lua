return {
  config = function()
    require('snacks').setup {
      -- used
      input = { enabled = true },
      picker = { enabled = true },
      terminal = { enabled = true },
      -- not used
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
    }
  end,
}
