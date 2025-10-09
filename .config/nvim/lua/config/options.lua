vim.cmd([[set mouse=]])
vim.cmd([[set noswapfile]])
vim.o.tabstop = 2
vim.o.shiftwidth = 2
vim.o.signcolumn = "yes"
vim.o.wrap = false
vim.o.cursorcolumn = false
vim.o.ignorecase = true
vim.o.smartindent = true
vim.o.termguicolors = true
vim.o.undofile = true
vim.o.number = true
vim.o.relativenumber = true

-- ui
vim.cmd("colorscheme vague")
vim.cmd [[set completeopt+=menuone,noselect,popup]]
vim.cmd(":hi satusline guibg=NONE")
vim.o.winborder = "rounded"
