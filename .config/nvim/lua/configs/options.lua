vim.g.mapleader = ' '
vim.g.maplocalleader = ' '
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

vim.o.mouse = 'a'
vim.o.tabstop = 2
vim.o.shiftwidth = 2
vim.o.signcolumn = 'yes'
vim.o.wrap = false
vim.o.cursorcolumn = false
vim.o.ignorecase = true
vim.o.smartindent = true
vim.o.termguicolors = true
vim.o.undofile = true
vim.o.number = true
vim.o.relativenumber = true
vim.o.winborder = 'rounded'
vim.o.splitright = true
vim.o.splitbelow = true

vim.cmd [[set noswapfile]]
vim.cmd ':hi satusline guibg=NONE'

vim.schedule(function()
	vim.opt.clipboard = 'unnamedplus'
end)
vim.api.nvim_create_autocmd('TextYankPost', {
	desc = 'Highlight when yanking (copying) text',
	group = vim.api.nvim_create_augroup('highlight-when-yank', { clear = true }),
	callback = function()
		vim.highlight.on_yank()
	end,
})
vim.api.nvim_create_autocmd('TermOpen', {
	desc = 'Disable number and relative number in terminal',
	group = vim.api.nvim_create_augroup('term-open', { clear = true }),
	callback = function()
		vim.o.number = false
		vim.o.relativenumber = false
	end,
})

-- fold
vim.o.foldenable = true
vim.o.foldlevel = 99
vim.o.foldmethod = "expr"
vim.o.foldexpr = "v:lua.vim.treesitter.foldexpr()"
vim.o.foldtext = ""
vim.o.foldcolumn = "0"
vim.api.nvim_create_autocmd('LspAttach', {
	callback = function(args)
		local client = vim.lsp.get_client_by_id(args.data.client_id)
		if client == nil then return end
		if client:supports_method('textDocument/foldingRange') then
			local win = vim.api.nvim_get_current_win()
			vim.wo[win][0].foldexpr = 'v:lua.vim.lsp.foldexpr()'
		end
	end,
})
