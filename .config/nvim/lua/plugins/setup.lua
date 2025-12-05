local _ = require 'installer'

_.install {
  plugins = {
    { name = 'vague', repo = 'vague2k/vague.nvim' },
    { name = 'nvim-treesitter', repo = 'nvim-treesitter/nvim-treesitter', version = 'main' },
    { name = 'treesitter-context', repo = 'nvim-treesitter/nvim-treesitter-context' },
    { name = 'vimwiki', repo = 'vimwiki/vimwiki', version = 'dev' },
    { name = 'mini.pairs', repo = 'nvim-mini/mini.pairs' },
    { name = 'mini.icons', repo = 'nvim-mini/mini.icons' },
    { name = 'mini.starter', repo = 'nvim-mini/mini.starter' },
    { name = 'oil', repo = 'stevearc/oil.nvim' },
    { name = 'better-escape', repo = 'max397574/better-escape.nvim' },
    { name = 'todo-comments', repo = 'folke/todo-comments.nvim' },
    { name = 'gitsigns', repo = 'lewis6991/gitsigns.nvim' },
    { name = 'img-clip', repo = 'hakonharnes/img-clip.nvim' },
    { name = 'markdown-preview', repo = 'iamcco/markdown-preview.nvim' },
    { name = 'lazygit', repo = 'kdheepak/lazygit.nvim' },
    { name = 'fidget', repo = 'j-hui/fidget.nvim' },
    { name = 'conform', repo = 'stevearc/conform.nvim' },
    { name = 'supermaven', repo = 'supermaven-inc/supermaven-nvim' },
    { name = 'smear-cursor', repo = 'sphamba/smear-cursor.nvim' },
    { name = 'fzf-lua', repo = 'ibhagwan/fzf-lua' },
    { name = 'claude-code', repo = 'greggh/claude-code.nvim', deps = { 'nvim-lua/plenary.nvim' } },
    {
      name = 'dap',
      repo = 'mfussenegger/nvim-dap',
      deps = { 'mason-org/mason.nvim' },
    },
    { name = 'dap-view', repo = 'igorlfs/nvim-dap-view' },
    {
      name = 'codecompanion',
      repo = 'olimorris/codecompanion.nvim',
      deps = { 'nvim-lua/plenary.nvim' },
    },
    {
      name = 'render-markdown',
      repo = 'MeanderingProgrammer/render-markdown.nvim',
      deps = {
        { repo = 'nvim-treesitter/nvim-treesitter', version = 'main' },
      },
    },
  },
  setup_dir = vim.fn.stdpath 'config' .. '/lua/plugins/',
}
