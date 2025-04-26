local prefix = '<leader>a'

return {
  {
    'olimorris/codecompanion.nvim',
    enabled = true,
    dependencies = {
      'nvim-lua/plenary.nvim',
      { 'nvim-treesitter/nvim-treesitter', build = ':TSUpdate' },
      'j-hui/fidget.nvim',
    },
    cmd = {
      'CodeCompanion',
      'CodeCompanionChat',
      'CodeCompanionCmd',
      'CodeCompanionActions',
      'CodeCompanionChat Toggle',
      'CodeCompanionChat Add',
    },
    keys = {
      {
        prefix .. 'a',
        '<cmd>CodeCompanionActions<cr>',
        mode = { 'n', 'v' },
        desc = 'Action Palette',
      },
      {
        prefix .. 'c',
        '<cmd>CodeCompanionChat<cr>',
        mode = { 'n', 'v' },
        desc = 'New Chat',
      },
      {
        prefix .. 'C',
        '<cmd>CodeCompanionCmd<cr>',
        mode = { 'n', 'v' },
        desc = 'Generate a command in CLI',
      },
      {
        prefix .. 'i',
        '<cmd>CodeCompanion<cr>',
        mode = { 'n', 'v' },
        desc = 'Inline Prompt',
      },
      {
        prefix .. 'A',
        '<cmd>CodeCompanionChat Add<cr>',
        mode = 'v',
        desc = 'Add Code',
      },
      {
        prefix .. 't',
        '<cmd>CodeCompanionChat Toggle<cr>',
        mode = { 'n', 'v' },
        desc = 'Toggle Chat',
      },
    },
    opts = {
      language = 'Korean',
      -- https://codecompanion.olimorris.dev/configuration/adapters.html
      adapters = {
        chat = function()
          return require('codecompanion.adapters').extend('gemini', {
            env = {
              api_key = os.getenv 'GEMINI_API_KEY',
            },
            schema = {
              model = {
                default = 'gemini-2.5-pro-exp-03-25',
              },
            },
          })
        end,
        -- chat = function()
        --   return require('codecompanion.adapters').extend('anthropic', {
        --     env = {
        --       api_key = os.getenv 'ANTHROPIC_API_KEY',
        --     },
        --     schema = {
        --       model = {
        --         default = 'claude-3-7-sonnet-20250219',
        --       },
        --     },
        --   })
        -- end,
        inline = function()
          return require('codecompanion.adapters').extend('gemini', {
            env = {
              api_key = os.getenv 'GEMINI_API_KEY',
            },
            schema = {
              model = {
                default = 'gemini-2.0-flash',
              },
            },
          })
        end,
        -- inline = function()
        --   return require('codecompanion.adapters').extend('gemini', {
        --     env = {
        --       api_key = os.getenv 'ANTHROPIC_API_KEY',
        --     },
        --     schema = {
        --       model = {
        --         default = 'claude-3-7-sonnet-20250219',
        --         choices = {
        --           ['claude-3-7-sonnet-20250219'] = {
        --             opts = { can_reason = false },
        --           },
        --         },
        --       },
        --     },
        --   })
        -- end,
      },
      strategies = {
        chat = {
          adapter = 'chat',
        },
        inline = {
          adapter = 'inline',
        },
      },
      display = {
        diff = {
          provider = 'mini_diff',
        },
      },
      opts = {
        log_level = 'DEBUG',
      },
    },
    init = function()
      require('plugins.ai.codecompanion-spinner'):init()
    end,
  },
}
