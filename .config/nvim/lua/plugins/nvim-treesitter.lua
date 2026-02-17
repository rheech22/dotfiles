return {
  config = function()
    local treesitter = require 'nvim-treesitter'
    treesitter.setup {}
    treesitter.install {
      'lua',
      'vim',
      'vimdoc',
      'css',
      'html',
      'yaml',
      'bash',
      'javascript',
      'jsx',
      'typescript',
      'tsx',
      'dart',
      'python',
      'markdown',
      'markdown_inline',
    }
    vim.treesitter.language.register('markdown', 'vimwiki')
  end,
}
