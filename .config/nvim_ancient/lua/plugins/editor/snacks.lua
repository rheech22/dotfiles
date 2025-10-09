return {
  {
    'folke/snacks.nvim',
    priority = 1000,
    lazy = false,
    ---@type snacks.Config
    opts = {
      -- your configuration comes here
      -- or leave it empty to use the default settings
      -- refer to the configuration section below
      bigfile = { enabled = true },
      indent = { enabled = true },
      input = { enabled = true },
      notifier = { enabled = true },
      quickfile = { enabled = true },
      scroll = { enabled = true },
      statuscolumn = { enabled = true },
      words = { enabled = true },
      dashboard = {
        enabled = true,
        preset = {
          header = [[
            _____            _____      ______       ___________
    _________  /______________  /_________  /_      ___  /__  /
    __  ___/  __/_  ___/  _ \  __/  ___/_  __ \     __  /__  /
    _(__  )/ /_ _  /   /  __/ /_ / /__ _  / / /      /_/  /_/
    /____/ \__/ /_/    \___/\__/ \___/ /_/ /_/      (_)  (_)

        ]],
        },
      },
    },
  },
}
