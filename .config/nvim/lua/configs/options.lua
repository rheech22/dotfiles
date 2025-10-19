vim.g.mapleader = ' '
vim.g.maplocalleader = ' '
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

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

vim.cmd [[set mouse=]]
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
