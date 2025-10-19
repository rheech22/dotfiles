local L = function(key)
  return '<leader>' .. key
end
local C = function(cmd)
  return '<Cmd>' .. cmd .. '<CR>'
end
local map = function(mode, lhs, rhs, desc, opts)
  opts = opts or {}
  opts.desc = desc
  vim.keymap.set(mode, lhs, rhs, opts)
end

-- file & buffer
map('n', L 'w', C 'write', 'Write buffer')
map('n', L 'q', C 'quit', 'Quit window')
map('n', L 'Q', C 'wqa', 'Write and quit all')
map('n', L 'e', C 'Oil', 'Open file explorer')
map('n', L 'E', C 'lua require("oil").open_float()', 'Open file explorer (float)')
map({ 'n', 'v', 'x' }, L 's', C 'e #', 'Edit alternate file')
map({ 'n', 'v', 'x' }, L 'S', C 'bot sf #', 'Split and edit alternate file')

-- picker
map('n', L 'g', C 'Pick grep_live', 'Grep live')
map('n', L '<space>', C 'Pick files', 'Find files')
map('n', L 'r', C 'Pick buffers', 'Find buffers')
map('n', L 'h', C 'Pick help', 'Find help')

-- lsp
map('n', L 'lf', C 'lua vim.lsp.buf.format()', 'Format buffer')
map('n', L 'cr', C 'lua vim.lsp.buf.rename()', 'Rename symbol')
map('n', L 'ca', C 'lua vim.lsp.buf.code_action()', 'Code action')
map('n', 'gd', C 'lua vim.lsp.buf.definition()', 'Go to definition')
map('n', 'gl', C 'lua vim.diagnostic.open_float()', 'Show diagnostics')
map('n', 'dn', C 'lua vim.diagnostic.jump({ count = 1, float = true })', 'Next diagnostic')
map('n', 'dp', C 'lua vim.diagnostic.jump({ count = -1, float = true })', 'Previous diagnostic')

-- editing
map('n', L 'ip', C 'PasteImage', 'Paste image from clipboard')
map('n', L 'zz', C 'exe "norm! i```"| exe "norm! O```" | startinsert!', 'Generate Code Block')
map('n', 'U', '<C-r>', 'Redo')

-- popup
map('i', '<Tab>', 'pumvisible() ? "<C-n>" : "<Tab>"', 'Move Next Completion Item', { expr = true })
map('i', '<S-Tab>', 'pumvisible() ? "<C-p>" : "<S-Tab>"', 'Move Next Completion Item', { expr = true })
map('i', '<CR>', 'pumvisible() ? "<C-y>" : "<CR>"', 'Move Next Completion Item', { expr = true })

-- navigation
map('n', '<C-k>', '<C-u>zz', 'Scroll up and center')
map('n', '<C-j>', '<C-d>zz', 'Scroll down and center')
map('n', 'n', 'nzzzv', 'Next search result and center')
map('n', 'N', 'Nzzzv', 'Previous search result and center')

-- config files
map({ 'n', 'v', 'x' }, L 'v', C 'e $MYVIMRC', 'Edit nvim config')
map({ 'n', 'v', 'x' }, L 'z', C 'e ~/.zshrc', 'Edit zshrc')
map({ 'n', 'v', 'x' }, L 'wz', C 'e ~/.config/wezterm/wezterm.lua', 'Edit wezterm config')
map({ 'n', 'v', 'x' }, L 'o', C 'source $MYVIMRC', 'Source ' .. vim.fn.expand '$MYVIMRC')
map({ 'n', 'v', 'x' }, L 'O', C 'restart', 'Restart vim.')

-- system
map('n', '<C-f>', C 'Open .', 'Open current directory in Finder.')

-- control panes
-- also at terminal?
map({ 'n', 't' }, 'ss', C 'split', 'Split horizontal', { noremap = true, silent = true })
map({ 'n', 't' }, 'sv', C 'vsplit', 'Split vertical', { noremap = true, silent = true })
map({ 'n', 't' }, 'sk', '<C-w>k', 'Focus pane above')
map({ 'n', 't' }, 'sh', '<C-w>h', 'Focus pane left')
map({ 'n', 't' }, 'sj', '<C-w>j', 'Focus pane below')
map({ 'n', 't' }, 'sl', '<C-w>l', 'Focus pane right')
map({ 'n', 't' }, 'sq', '<C-w>q', 'Close pane')
map({ 'n', 't' }, '<C-w><left>', '<C-w><', 'Decrease pane width')
map({ 'n', 't' }, '<C-w><right>', '<C-w>>', 'Increase pane width')
map({ 'n', 't' }, '<C-w><up>', '<C-w>+', 'Increase pane height')
map({ 'n', 't' }, '<C-w><down>', '<C-w>-', 'Decrease pane height')

-- plugin:vimwiki
map('n', '\\ww', '<Plug>VimwikiIndex', 'Go to WikiIndex')
map('n', '\\wi', '<Plug>VimwikiDiaryIndex', 'Go to DiaryIndex')
map('n', '\\w\\w', '<Plug>VimwikiMakeDiaryNote', 'Create a Diary Note')
map('n', '\\w\\g', '<Plug>VimwikiDiaryGenerateLinks', 'Generate Links for Diary Notes')
map('n', '\\]', '<Plug>VimwikiToggleListItem', 'Toggle List Item')

-- plugin:lazygit
map('n', L 'lg', C 'LazyGit', 'Open LazyGit', { silent = true })

-- plugin:dap
map('n', L 'dc', C 'lua require("dap").continue()', 'Run/Continue')
map('n', L 'db', C 'lua require("dap").toggle_breakpoint()', 'Toggle Breakpoint')
map('n', L 'di', C 'lua require("dap").step_into()', 'Step Into')
map('n', L 'do', C 'lua require("dap").step_over()', 'Step Over')
map('n', L 'dO', C 'lua require("dap").step_out()', 'Step Out')
map('n', L 'dt', C 'lua require("dap").terminate()', 'Terminate')

-- plugin:dap-view
map('n', L 'dv', C 'lua require("dap-view").toggle()', 'Toggle Debug View')

-- plugin:flutter-tools
map('n', L 'fl', C 'FlutterRun', 'Flutter Run')
map('n', L 'fq', C 'FlutterQuit', 'Flutter Quit')
map('n', L 'fo', C 'FlutterReload', 'Flutter Reload')
map('n', L 'fr', C 'FlutterRestart', 'Flutter Restart')
map('n', L 'fb', C 'FlutterPubGet', 'Flutter PubGet')
map('n', L 'fg', C '!dart run build_runner build --delete-conflicting-outputs', 'Flutter Code Generate')
