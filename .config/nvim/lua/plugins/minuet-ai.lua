return {
  config = function()
    require('minuet').setup {
      provider = 'codestral',
      request_timeout = 10,
      throttle = 2000,
      notify = 'error',
      n_completions = 2,

      blink = {
        enable_auto_complete = false,
      },

      virtualtext = {
        keymap = {
          accept = '<c-m>',
          next = '<c-n>',
          accept_line = nil,
          accept_n_lines = nil,
          prev = nil,
          dismiss = nil,
        },
        auto_trigger_ft = { 'lua', 'typescript', 'typescriptreact' },
        show_on_completion_menu = true,
      },

      provider_options = {

        codestral = {
          optional = {
            max_tokens = 256,
            stop = { '\n\n' },
          },
        },

        gemini = {
          optional = {
            generationConfig = {
              maxOutputTokens = 256,
              topP = 0.9,
            },
            safetySettings = {
              {
                category = 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold = 'BLOCK_NONE',
              },
              {
                category = 'HARM_CATEGORY_HATE_SPEECH',
                threshold = 'BLOCK_NONE',
              },
              {
                category = 'HARM_CATEGORY_HARASSMENT',
                threshold = 'BLOCK_NONE',
              },
              {
                category = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold = 'BLOCK_NONE',
              },
            },
          },
        },
      },
    }
  end,
}
