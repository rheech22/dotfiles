return {
  --{
  --  "rose-pine/neovim",
  --  name = "rose-pine",
  --  config = function()
  --    require("rose-pine").setup({
  --      variant = "moon",
  --      dark_variant = "moon",
  --      styles = {
  --        bold = true,
  --        italic = true,
  --        transparency = true,
  --      },
  --    })
  --    vim.cmd("colorscheme rose-pine")
  --  end,
  --},
  -- {
  --   "catppuccin/nvim",
  --   name = "catppuccin",
  --   priority = 1000,
  --   config = function()
  --     require("catppuccin").setup({
  --       integrations = {
  --         blink_cmp = true,
  --         harpoon = true,
  --         mason = true,
  --         noice = true,
  --         copilot_vim = true,
  --         notify = true,
  --         vimwiki = true,
  --         snacks = true,
  --       },
  --     })
  --   end,
  -- },
  {
    "scottmckendry/cyberdream.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("cyberdream").setup({
        transparent = true,
        italic_comments = true,

        theme = {
          variant = "default", -- use "light" for the light variant. Also accepts "auto" to set dark or light colors based on the current value of `vim.o.background`
          saturation = 1, -- accepts a value between 0 and 1. 0 will be fully desaturated (greyscale) and 1 will be the full color (default)
          highlights = {
            -- Highlight groups to override, adding new groups is also possible
            -- See `:h highlight-groups` for a list of highlight groups or run `:hi` to see all groups and their current values

            -- Example:
            -- Comment = { fg = "#696969", bg = "NONE", italic = true },

            -- Complete list can be found in `lua/cyberdream/theme.lua`
          },

          -- Override a highlight group entirely using the color palette
          overrides = function(colors) -- NOTE: This function nullifies the `highlights` option
            -- Example:
            return {
              Visual = { bg = colors.grey, fg = colors.magenta },
              Comment = { fg = "#b48ead", bold = false },
              -- ["@type"] = { fg = colors.pink, bold = false },
              ["@variable"] = { fg = "#d8dee9", bold = false },
              ["@property"] = { fg = colors.pink, bold = false },
            }
          end,

          -- Override a color entirely
          colors = {
            -- For a list of colors see `lua/cyberdream/colours.lua`
            -- Example:
            -- magenta = "#ff00ff",
          },
        },
      })
    end,
  },
}
