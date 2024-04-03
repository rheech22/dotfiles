return {
  --  "craftzdog/solarized-osaka.nvim",
  --  lazy = true,
  --  priority = 1000,
  --  opts = function()
  --    return {
  --      transparent = true,
  --      on_highlights = function(hl, c)
  --        hl.DashboardHeader = { fg = "#739072" }
  --      end,
  --    }
  --  end,
  -- { "shaunsingh/nord.nvim" },
  --  {
  --    "LazyVim/LazyVim",
  --    opts = {
  --      colorscheme = "nord",
  --    },
  --  },
  --  "nyoom-engineering/oxocarbon.nvim",
  --  config = function()
  --    vim.opt.background = "light" -- set this to dark or light
  --    vim.cmd("colorscheme oxocarbon")
  --  end,
  {
    "rose-pine/neovim",
    name = "rose-pine",
    config = function()
      require("rose-pine").setup({
        variant = "moon",
        dark_variant = "moon",
        highlight_groups = {
          TelescopeBorder = { fg = "overlay", bg = "overlay" },
          TelescopeNormal = { fg = "subtle", bg = "overlay" },
          TelescopeSelection = { fg = "text", bg = "highlight_med" },
          TelescopeSelectionCaret = { fg = "love", bg = "highlight_med" },
          TelescopeMultiSelection = { fg = "text", bg = "highlight_high" },
          TelescopeTitle = { fg = "base", bg = "love" },
          TelescopePromptTitle = { fg = "base", bg = "pine" },
          TelescopePreviewTitle = { fg = "base", bg = "iris" },
          TelescopePromptNormal = { fg = "text", bg = "surface" },
          TelescopePromptBorder = { fg = "surface", bg = "surface" },
        },
      })
      vim.cmd("colorscheme rose-pine")
    end,
  },
}
