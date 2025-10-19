local H = require 'helpers'

vim.lsp.enable { 'lua_ls', 'tailwindcss', 'cssls', 'astro' }

local lsp_plugins = {
  { name = 'plenary', src = H.github 'nvim-lua/plenary.nvim' },
  { name = 'mason', src = H.github 'mason-org/mason.nvim' },
  { name = 'nvim-lspconfig', src = H.github 'neovim/nvim-lspconfig' },
  { name = 'nvim-eslint', src = H.github 'esmuellert/nvim-eslint' },
  { name = 'flutter-tools', src = H.github 'nvim-flutter/flutter-tools.nvim' },
  { name = 'typescript-tools', src = H.github 'pmizio/typescript-tools.nvim' },
  { name = 'lspkind', src = H.github 'onsails/lspkind.nvim' },
}
vim.pack.add(lsp_plugins)

local plugins_dir = vim.fn.stdpath 'config' .. '/lua/lsps/'
for _, plugin in ipairs(lsp_plugins) do
  local setting = H.get_plugin_setting(plugins_dir, plugin)
  if setting and setting.config then
    setting.config()
  end
end

vim.api.nvim_create_autocmd('LspAttach', {
  group = vim.api.nvim_create_augroup('auto_completion', {}),
  callback = function(args)
    local client = assert(vim.lsp.get_client_by_id(args.data.client_id))
    if client:supports_method 'textDocument/completion' then
      local chars = {}
      for i = 32, 126 do
        table.insert(chars, string.char(i))
      end
      client.server_capabilities.completionProvider.triggerCharacters = chars
      vim.lsp.completion.enable(true, client.id, args.buf, { autotrigger = true })
    end
  end,
})
vim.cmd [[set completeopt+=menuone,noselect,popup]]
