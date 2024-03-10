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
  { "shaunsingh/nord.nvim" },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "nord",
    },
  },
}
