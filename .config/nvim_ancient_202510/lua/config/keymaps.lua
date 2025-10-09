local keymap = vim.keymap
local opts = { noremap = true, silent = true }

-- Move And Align Center
keymap.set('n', '<C-k>', '<C-u>zz')
keymap.set('n', '<C-j>', '<C-d>zz')

-- Search And Align Center
keymap.set('n', 'n', 'nzzzv')
keymap.set('n', 'N', 'Nzzzv')

-- Select All
keymap.set('n', '<C-a>', 'gg<S-v>G')

-- Control Tabs
keymap.set('n', 'te', ':tabedit<Return>')
keymap.set('n', 'tc', ':tabclose<Return>')
keymap.set('n', 'tn', ':tabnext<Return>', opts)
keymap.set('n', 'tp', ':tablprev<Return>', opts)

-- Control Buffers
keymap.set('n', '<S-h>', '<cmd>bprevious<cr>', { desc = 'Prev Buffer' })
keymap.set('n', '<S-l>', '<cmd>bnext<cr>', { desc = 'Next Buffer' })
keymap.set('n', '[b', '<cmd>bprevious<cr>', { desc = 'Prev Buffer' })
keymap.set('n', ']b', '<cmd>bnext<cr>', { desc = 'Next Buffer' })
keymap.set('n', '<leader>bd', function()
  Snacks.bufdelete()
end, { desc = 'Delete Buffer' })
keymap.set('n', '<leader>bo', function()
  Snacks.bufdelete.other()
end, { desc = 'Delete Other Buffers' })
keymap.set(
  'n',
  '<leader>bD',
  '<cmd>:bd<cr>',
  { desc = 'Delete Buffer and Window' }
)

-- Control Panes
-- Split
keymap.set('n', 'ss', ':split<Return>', opts)
keymap.set('n', 'sv', ':vsplit<Return>', opts)
-- Split Terminal
keymap.set('n', 'st', ':sp | term<CR>', { silent = true })
keymap.set('n', 'stv', ':vsp | term<CR>', { silent = true })
-- Move
keymap.set('n', 'sk', '<C-w>k')
keymap.set('n', 'sh', '<C-w>h')
keymap.set('n', 'sj', '<C-w>j')
keymap.set('n', 'sl', '<C-w>l')
-- Switch
keymap.set('n', 'sw', '<C-w>w')
-- Quit
keymap.set('n', 'sq', '<C-w>q')
-- Resize
keymap.set('n', '<C-w><left>', '<C-w><')
keymap.set('n', '<C-w><right>', '<C-w>>')
keymap.set('n', '<C-w><up>', '<C-w>+')
keymap.set('n', '<C-w><down>', '<C-w>-')

-- Paste Repeatedly
keymap.set('x', '<leader>p', '"_dP')

-- Highlight When Yanking text
vim.api.nvim_create_autocmd('TextYankPost', {
  desc = 'Highlight when yanking (copying) text',
  group = vim.api.nvim_create_augroup(
    'kickstart-highlight-yank',
    { clear = true }
  ),
  callback = function()
    vim.highlight.on_yank()
  end,
})

-- Generate Code Block
keymap.set(
  'n',
  '<leader>z',
  '<Cmd>exe "norm! i\\`\\`\\`"| exe "norm! O\\`\\`\\`" | startinsert! <CR>',
  { desc = 'Generate Code Block' }
)

-- Better indenting
keymap.set('v', '<', '<gv')
keymap.set('v', '>', '>gv')

-- Jump To Diagnostics
keymap.set('n', '<leader>j', function()
  vim.diagnostic.goto_next()
end, { desc = 'Jump To Diagnostics' })
