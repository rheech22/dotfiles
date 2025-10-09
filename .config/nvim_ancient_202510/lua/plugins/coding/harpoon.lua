return {
  -- https://github.com/ThePrimeagen/harpoon/tree/harpoon2
  {
    'theprimeagen/harpoon',
    branch = 'harpoon2',
    dependencies = { 'nvim-lua/plenary.nvim' },
    config = function()
      require('harpoon'):setup()
    end,
    keys = function()
      local keys = {
        {
          ';;',
          function()
            local harpoon = require 'harpoon'
            harpoon.ui:toggle_quick_menu(harpoon:list())
          end,
          desc = 'Open harpoon window',
        },
        {
          ';a',
          function()
            require('harpoon'):list():add()
          end,
          desc = 'harpoon file',
        },
        {
          ';r',
          function()
            require('harpoon'):list():remove()
          end,
          desc = 'remove this file from harpoon list',
        },
        {
          ';c',
          function()
            require('harpoon'):list():clear()
          end,
          desc = 'clear harpoon list',
        },
        {
          '<C-n>',
          function()
            require('harpoon'):list():next()
          end,
          desc = 'next file',
        },
        {

          '<C-p>',
          function()
            require('harpoon'):list():prev()
          end,
          desc = 'prev file',
        },
      }
      --
      -- for i = 1, 5 do
      --   table.insert(keys, {
      --     '<leader>t' .. i,
      --     function()
      --       require('harpoon'):list():select(i)
      --     end,
      --     desc = 'Harpoon to File ' .. i,
      --   })
      -- end
      --
      -- for i = 1, 5 do
      --   table.insert(keys, {
      --     '<leader>r' .. i,
      --     function()
      --       require('harpoon'):list().remove_at(self, i)
      --     end,
      --     desc = 'Remove Harpoon ' .. i,
      --   })
      -- end

      return keys
    end,
  },
}
