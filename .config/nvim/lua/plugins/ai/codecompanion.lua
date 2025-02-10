local prefix = '<leader>a'

return {
  {
    'olimorris/codecompanion.nvim',
    enabled = false,
    dependencies = {
      'nvim-lua/plenary.nvim',
      'nvim-treesitter/nvim-treesitter',
    },
    cmd = {
      'CodeCompanion',
      'CodeCompanionActions',
      'CodeCompanionToggle',
      'CodeCompanionAdd',
      'CodeCompanionChat',
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
        prefix .. 'A',
        '<cmd>CodeCompanionAdd<cr>',
        mode = 'v',
        desc = 'Add Code',
      },
      {
        prefix .. 'i',
        '<cmd>CodeCompanion<cr>',
        mode = 'n',
        desc = 'Inline Prompt',
      },
      {
        prefix .. 'C',
        '<cmd>CodeCompanionToggle<cr>',
        mode = 'n',
        desc = 'Toggle Chat',
      },
    },
    opts = {
      -- https://codecompanion.olimorris.dev/configuration/adapters.html
      adapters = {
        openai = function()
          return require('codecompanion.adapters').extend('openai', {
            env = {
              api_key = os.getenv 'OPENAI_API_KEY',
            },
            schema = {
              model = {
                default = 'gpt-4o-mini',
              },
            },
          })
        end,
      },
      strategies = {
        chat = {
          adapter = 'openai',
        },
        inline = {
          adapter = 'openai',
        },
      },
      log_level = 'DEBUG',
    },
  },
}
