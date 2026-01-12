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
      'javascript',
      'typescript',
      'dart',
      'python',
      'tsx',
    }
  end,
}
