return {
  config = function()
    local mini_snippets = require 'mini.snippets'
    local loader = mini_snippets.gen_loader

    mini_snippets.setup {
      snippets = {
        loader.from_file '~/.config/nvim/snippets/example.json',
        loader.from_lang {
          lang_patterns = {
            javascript = { 'javascript.json' },
            typescript = { 'javascript.json' },
            javascriptreact = { 'javascript.json' },
            typescriptreact = { 'javascript.json' },
            tsx = { 'javascript.json' },
            vimwiki = { 'markdown.json' },
            markdown = { 'markdown.json' },
          },
        },
      },
    }
  end,
}
