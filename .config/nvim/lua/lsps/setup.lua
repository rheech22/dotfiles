local _ = require 'installer'

_.install {
  plugins = {
    {
      name = 'mason',
      repo = 'mason-org/mason.nvim',
    },
    {
      name = 'mason-lspconfig',
      repo = 'mason-org/mason-lspconfig.nvim',
    },
    {
      name = 'lspkind',
      repo = 'onsails/lspkind.nvim',
    },
    {
      name = 'nvim-lspconfig',
      repo = 'neovim/nvim-lspconfig',
    },
    {
      name = 'typescript-tools',
      repo = 'pmizio/typescript-tools.nvim',
    },
    {
      name = 'flutter-tools',
      repo = 'nvim-flutter/flutter-tools.nvim',
      deps = { 'nvim-lua/plenary.nvim' },
    },
  },
  setup_dir = vim.fn.stdpath 'config' .. '/lua/lsps/',
}

-- show auto completion natevly
-- vim.api.nvim_create_autocmd('LspAttach', {
-- 	group = vim.api.nvim_create_augroup('auto_completion', {}),
-- 	callback = function(args)
-- 		local client = assert(vim.lsp.get_client_by_id(args.data.client_id))
-- 		if client:supports_method 'textDocument/completion' then
-- 			local chars = {}
-- 			for i = 32, 126 do
-- 				table.insert(chars, string.char(i))
-- 			end
-- 			client.server_capabilities.completionProvider.triggerCharacters = chars
-- 			vim.lsp.completion.enable(true, client.id, args.buf, { autotrigger = true })
-- 		end
-- 	end,
-- })
-- vim.cmd [[set completeopt+=menuone,noselect,popup]]
