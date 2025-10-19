return {
  config = function()
    require('codecompanion').setup {
      -- https://codecompanion.olimorris.dev/configuration/adapters.html
      adapters = {
        http = {
          chat = function()
            return require('codecompanion.adapters').extend('gemini', {
              env = {
                api_key = os.getenv 'GEMINI_API_KEY',
              },
              schema = {
                model = {
                  default = 'gemini-2.5-pro',
                },
              },
            })
          end,
          inline = function()
            return require('codecompanion.adapters').extend('gemini', {
              env = {
                api_key = os.getenv 'GEMINI_API_KEY',
              },
              schema = {
                model = {
                  default = 'gemini-2.5-flash',
                },
              },
            })
          end,
        },
      },
      strategies = {
        chat = {
          adapter = 'chat',
          -- adapter = 'gemini_cli',
        },
        inline = {
          adapter = 'inline',
        },
      },
      display = {
        chat = {
          show_settings = false,
        },
        action_palette = {
          width = 95,
          height = 10,
          prompt = 'Prompt ',
          provider = 'default',
        },
      },
      opts = {
        log_level = 'TRACE',
      },
    }
  end,
}
