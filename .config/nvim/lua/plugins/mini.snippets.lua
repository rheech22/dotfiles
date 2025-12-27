return {
  config = function()
    local mini_snippets = require 'mini.snippets'
    local loader = mini_snippets.gen_loader

    local lang_patterns = {
      -- js, ts
      javascript = { 'javascript.json' },
      typescript = { 'javascript.json' },
      javascriptreact = { 'javascript.json' },
      typescriptreact = { 'javascript.json' },

      -- markdown
      markdown = { 'markdown.json' },
    }

    mini_snippets.setup {
      snippets = {
        loader.from_file '~/.config/nvim/snippets/example.json',
        loader.from_lang {
          lang_patterns = lang_patterns,
        },
      },
    }
  end,
}
