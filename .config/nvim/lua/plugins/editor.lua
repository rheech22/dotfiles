return {

  -- https://github.com/folke/flash.nvim
  {
    enabled = false,
    "folke/flash.nvim",
    ---@type Flash.Config
    opts = {
      search = {
        forward = true,
        multi_window = false,
        wrap = false,
        incremental = true,
      },
    },
  },

  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = {

      window = {
        position = "float",
      },
      filesystem = {
        filtered_items = {
          visible = true,
          show_hidden_count = true,
          hide_dotfiles = false,
          hide_gitignored = false,
          hide_by_name = {
            -- '.git',
            -- '.DS_Store',
            -- 'thumbs.db',
          },
          never_show = {},
        },
      },
    },
  },

  -- https://github.com/ThePrimeagen/harpoon/tree/harpoon2
  {
    "theprimeagen/harpoon",
    branch = "harpoon2",
    dependencies = { "nvim-lua/plenary.nvim" },
    config = function()
      require("harpoon"):setup()
    end,
    keys = function()
      local keys = {
        {
          ";;",
          function()
            local harpoon = require("harpoon")
            harpoon.ui:toggle_quick_menu(harpoon:list())
          end,
          desc = "Open harpoon window",
        },
        {
          ";a",
          function()
            require("harpoon"):list():add()
          end,
          desc = "harpoon file",
        },
        {
          ";r",
          function()
            require("harpoon"):list():remove()
          end,
          desc = "remove this file from harpoon list",
        },
        {
          ";c",
          function()
            require("harpoon"):list():clear()
          end,
          desc = "clear harpoon list",
        },
        {
          "<C-n>",
          function()
            require("harpoon"):list():next()
          end,
          desc = "next file",
        },
        {

          "<C-p>",
          function()
            require("harpoon"):list():prev()
          end,
          desc = "prev file",
        },
      }

      for i = 1, 5 do
        table.insert(keys, {
          "<leader>t" .. i,
          function()
            require("harpoon"):list():select(i)
          end,
          desc = "Harpoon to File " .. i,
        })
      end

      for i = 1, 5 do
        table.insert(keys, {
          "<leader>r" .. i,
          function()
            require("harpoon"):list().remove_at(self, i)
          end,
          desc = "Remove Harpoon " .. i,
        })
      end

      return keys
    end,
  },
}
