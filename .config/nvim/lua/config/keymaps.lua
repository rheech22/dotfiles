local map = vim.keymap.set

map('n', '<leader>w', ':write<CR>')
map('n', '<leader>q', ':quit<CR>')
map('n', '<leader>Q', ':wqa<CR>')
map('n', '<leader>g', ':Pick grep_live<CR>')
map('n', '<leader>f', ':Pick files<CR>')
map('n', '<leader>r', ':Pick buffers<CR>')
map('n', '<leader>h', ':Pick help<CR>')
map('n', '<leader>e', ':Oil<CR>')
map('n', '<leader>E', require('oil').open_float)
map('n', '<leader>lf', vim.lsp.buf.format)
map('n', '<leader>cr', vim.lsp.buf.rename)
map('n', '<leader>ca', vim.lsp.buf.code_action)
map('n', 'gd', vim.lsp.buf.definition)
map('n', 'gl', vim.diagnostic.open_float)
map('n', 'dn', function()
	vim.diagnostic.jump({ count = 1, float = true })
end)
map('n', 'dp', function()
	vim.diagnostic.jump({ count = -1, float = true })
end)
map('n', '<leader>ip', ':PasteImage<CR>')
map(
	'n',
	'<leader>zz',
	'<Cmd>exe "norm! i\\`\\`\\`"| exe "norm! O\\`\\`\\`" | startinsert! <CR>',
	{ desc = 'Generate Code Block' }
)

map('n', '<C-k>', '<C-u>zz')
map('n', '<C-j>', '<C-d>zz')
map('n', 'n', 'nzzzv')
map('n', 'N', 'Nzzzv')

map({ "n", "v", "x" }, '<leader>v', ':e $MYVIMRC<CR>')
map({ "n", "v", "x" }, '<leader>z', ':e ~/.zshrc<CR>')
map({ "n", "v", "x" }, '<leader>wz', ':e ~/.config/wezterm/wezterm.lua<CR>')
map({ "n", "v", "x" }, "<leader>o", ":source $MYVIMRC<CR>", { desc = "Source " .. vim.fn.expand("$MYVIMRC") })
map({ "n", "v", "x" }, "<leader>O", ":restart<CR>", { desc = "Restart vim." })
map({ 'n', 'v', 'x' }, '<leader>d', '"+d<CR>')
map({ 'n', 'v', 'x' }, '<leader>s', ':e #<CR>')
map({ 'n', 'v', 'x' }, '<leader>S', ':bot sf #<CR>')
map({ "n" }, "<C-f>", "<Cmd>Open .<CR>", { desc = "Open current directory in Finder." })

-- control panes
map('n', 'ss', ':split<Return>', { noremap = true, silent = true })
map('n', 'sv', ':vsplit<Return>', { noremap = true, silent = true })
map('n', 'sk', '<C-w>k')
map('n', 'sh', '<C-w>h')
map('n', 'sj', '<C-w>j')
map('n', 'sl', '<C-w>l')
map('n', 'sq', '<C-w>q')
map('n', '<C-w><left>', '<C-w><')
map('n', '<C-w><right>', '<C-w>>')
map('n', '<C-w><up>', '<C-w>+')
map('n', '<C-w><down>', '<C-w>-')

-- plugin:vimwiki
map("n", "\\ww", "<Plug>VimwikiIndex", { desc = "Go to WikiIndex" })
map("n", "\\wi", "<Plug>VimwikiDiaryIndex", { desc = "Go to DiaryIndex" })
map("n", "\\w\\w", "<Plug>VimwikiMakeDiaryNote", { desc = "Create a Diary Note" })
map("n", "\\w\\g", "<Plug>VimwikiDiaryGenerateLinks", { desc = "Generate Links for Diary Notes" })
map("n", "\\]", "<Plug>VimwikiToggleListItem", { desc = "Toggle List Item" })
