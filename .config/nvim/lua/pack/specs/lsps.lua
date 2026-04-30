return {
  {
    name = 'mason',
    repo = 'mason-org/mason.nvim',
    concern = 'language',
    capabilities = { 'language' },
  },
  {
    name = 'mason-lspconfig',
    repo = 'mason-org/mason-lspconfig.nvim',
    concern = 'language',
    capabilities = { 'language' },
  },
  {
    name = 'lspkind',
    repo = 'onsails/lspkind.nvim',
    concern = 'language',
    capabilities = { 'language', 'completion' },
  },
  {
    name = 'nvim-lspconfig',
    repo = 'neovim/nvim-lspconfig',
  },
  {
    name = 'typescript-tools',
    repo = 'pmizio/typescript-tools.nvim',
    concern = 'language',
    capabilities = { 'language' },
  },
  {
    name = 'flutter-tools',
    repo = 'nvim-flutter/flutter-tools.nvim',
    concern = 'language',
    capabilities = { 'language', 'debug' },
    deps = { 'nvim-lua/plenary.nvim' },
  },
}
