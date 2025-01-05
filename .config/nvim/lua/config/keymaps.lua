-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
local keymap = vim.keymap
local opts = { noremap = true, silent = true }

-- Make Code Block
keymap.set("n", "<leader>z", '<Cmd>exe "norm! i\\`\\`\\`"| exe "norm! O\\`\\`\\`" | startinsert! <CR>')

-- Paste repeatedly
keymap.set("x", "<leader>p", '"_dP')

-- Move and Align
keymap.set("n", "<C-k>", "<C-u>zz")
keymap.set("n", "<C-j>", "<C-d>zz")

-- Search and Align
keymap.set("n", "n", "nzzzv")
keymap.set("n", "N", "Nzzzv")

-- Increment/decrement
keymap.set("n", "+", "<C-a>")
keymap.set("n", "-", "<C-x>")

-- Delete a word backwords
keymap.set("n", "dw", "vb_d")

-- Select all
keymap.set("n", "<C-a>", "gg<S-v>G")

-- Jumplist
keymap.set("n", "<C-m>", "<C-i>", opts)

-- New tab
keymap.set("n", "te", ":tabedit<Return>")
keymap.set("n", "tc", ":tabclose<Return>")
keymap.set("n", "tn", ":tabnext<Return>", opts)
keymap.set("n", "tp", ":tablprev<Return>", opts)

-- Split window
keymap.set("n", "ss", ":split<Return>", opts)
keymap.set("n", "sv", ":vsplit<Return>", opts)

-- Move window
--keymap.set("n", "<C-k>", "<C-w>k")
--keymap.set("n", "<C-h>", "<C-w>h")
--keymap.set("n", "<C-j>", "<C-w>j")
--keymap.set("n", "<C-l>", "<C-w>l")

-- Switch window
keymap.set("n", "sw", "<C-w>w")

-- Quit window
keymap.set("n", "sq", "<C-w>q")

-- Resize window
keymap.set("n", "<C-w><left>", "<C-w><")
keymap.set("n", "<C-w><right>", "<C-w>>")
keymap.set("n", "<C-w><up>", "<C-w>+")
keymap.set("n", "<C-w><down>", "<C-w>-")

-- Diagnostics
keymap.set("n", "<leader>j", function()
  vim.diagnostic.goto_next()
end)
