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
map('n', L 'z', C 'ZenMode', 'Toggle ZenMode')
map('n', L 'fp', C 'let @+=@%', 'Copy Path')

-- picker
map('n', L '<space>', C 'FzfLua files', 'Find files')
map('n', L 'b', C 'FzfLua buffers', 'Find buffers')
map('n', L 'h', C 'FzfLua helptags', 'Find help')
map('n', L 'g', C 'FzfLua live_grep', 'Grep live')
map('n', L 'r', C 'FzfLua oldfiles', 'Find recent files')
map('n', L 'fb', C 'FzfLua builtin', 'Show FzfLua builtin')
map('n', L 'fw', C 'FzfLua grep_cword', 'Grep word under cursor')
map('n', L 'fW', C 'FzfLua grep_cWORD', 'Grep WORD under cursor')
map('v', L 'fw', C 'FzfLua grep_visual', 'Grep visual selection')

-- lsp
map('n', L 'cr', C 'lua vim.lsp.buf.rename()', 'Rename symbol')
map('n', L 'ca', C 'lua vim.lsp.buf.code_action()', 'Code action')
map('n', 'gd', C 'lua vim.lsp.buf.definition()', 'Go to definition')
map('n', 'gl', C 'lua vim.diagnostic.open_float()', 'Show diagnostics')
map('n', 'dn', C 'lua vim.diagnostic.jump({ count = 1, float = true })', 'Next diagnostic')
map('n', 'dp', C 'lua vim.diagnostic.jump({ count = -1, float = true })', 'Previous diagnostic')
map('n', L 'lf', function()
  local bufnr = vim.api.nvim_get_current_buf()
  local eslint_client = vim.lsp.get_clients({ bufnr = bufnr, name = 'eslint' })[1]
  if eslint_client then
    vim.cmd 'LspEslintFixAll'
  else
    vim.lsp.buf.format { async = true }
  end
end, 'Format buffer')
map('n', '<C-l>', 'zo', 'Open the fold at the cursor.')
map('n', '<C-h>', 'zc', 'Close the fold at the cursor.')

-- editing
map('n', L 'ip', _G.paste_image_temporarily, 'Paste image from clipboard')
map('n', 'U', '<C-r>', 'Redo')
map({ 'n', 'v' }, '<C-w>', C 'set wrap', 'Wrap')

-- navigation
map({ 'n', 'v' }, '<C-k>', '<C-u>zz', 'Scroll up and center')
map({ 'n', 'v' }, '<C-j>', '<C-d>zz', 'Scroll down and center')
map('n', 'n', 'nzzzv', 'Next search result and center')
map('n', 'N', 'Nzzzv', 'Previous search result and center')

-- config files
map({ 'n', 'v', 'x' }, L 'xv', C 'e $MYVIMRC', 'Edit nvim config')
map({ 'n', 'v', 'x' }, L 'xz', C 'e ~/.zshrc', 'Edit zshrc')
map({ 'n', 'v', 'x' }, L 'xw', C 'e ~/.config/wezterm/wezterm.lua', 'Edit wezterm config')
map({ 'n', 'v', 'x' }, L 'o', C 'source $MYVIMRC', 'Source ' .. vim.fn.expand '$MYVIMRC')
map({ 'n', 'v', 'x' }, L 'O', C 'restart', 'Restart vim.')

-- system
map('n', '<C-f>', C 'Open .', 'Open current directory in Finder.')

-- control panes
map('n', 'ss', C 'split', 'Split horizontal', { noremap = true, silent = true })
map('n', 'sv', C 'vsplit', 'Split vertical', { noremap = true, silent = true })
map('n', 'sk', '<C-w>k', 'Focus pane above')
map('n', 'sh', '<C-w>h', 'Focus pane left')
map('n', 'sj', '<C-w>j', 'Focus pane below')
map('n', 'sl', '<C-w>l', 'Focus pane right')
map('n', 'sq', '<C-w>q', 'Close pane')
map('n', '<C-w><left>', '<C-w><', 'Decrease pane width')
map('n', '<C-w><right>', '<C-w>>', 'Increase pane width')
map('n', '<C-w><up>', '<C-w>+', 'Increase pane height')
map('n', '<C-w><down>', '<C-w>-', 'Decrease pane height')

-- terminal (snacks.terminal)
map('n', L 'tv', function()
  require('snacks').terminal(nil, {
    win = { style = 'terminal_right' },
    count = 1,
  })
end, 'Toggle terminal (vertical)')
map('n', L 'th', function()
  require('snacks').terminal(nil, {
    win = { style = 'terminal_bottom' },
    count = 2,
  })
end, 'Toggle terminal (horizontal)')
map('n', L 'ta', C 'set autochdir', 'Attach Terminal to Current Buffer')
map('n', L 'td', C 'set noautochdir', 'Detach Terminal from Current Buffer')
map('t', 'tq', '<C-\\><C-n>', 'Change to normal mode in terminal')

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
map('n', L 'Fl', C 'FlutterRun', 'Flutter Run')
map('n', L 'Fq', C 'FlutterQuit', 'Flutter Quit')
map('n', L 'Fo', C 'FlutterReload', 'Flutter Reload')
map('n', L 'Fr', C 'FlutterRestart', 'Flutter Restart')
map('n', L 'Fb', C 'FlutterPubGet', 'Flutter PubGet')
map('n', L 'Fg', C '!dart run build_runner build --delete-conflicting-outputs', 'Flutter Code Generate')

-- plugin:opencode
map({ 'n', 'x' }, '<C-y>', C "lua require('opencode').ask('@this: ', { submit = true })", 'Ask opencode')
map({ 'n', 'x' }, '<C-x>', C "lua require('opencode').select()", 'Execute opencode action…')
map({ 'n', 't' }, '<C-,>', C "lua require('opencode').toggle()", 'Toggle opencode')
map({ 'n', 'x' }, 'go', function()
  return require('opencode').operator '@this '
end, 'Add range to opencode', { expr = true })

-- plugin:flash
map({ 'n', 'x', 'o' }, 'm', function()
  require('flash').jump()
end, 'Flash')
map({ 'n', 'x', 'o' }, 'M', function()
  require('flash').treesitter()
end, 'Flash Treesitter')
map('o', 'r', function()
  require('flash').remote()
end, 'Remote Flash')
map({ 'x', 'o' }, 'R', function()
  require('flash').treesitter_search()
end, 'Treesitter Search')
map('c', '<C-s>', function()
  require('flash').toggle()
end, 'Toggle Flash Search')

-- plugin:overseer
map('n', L 'oo', C 'OverseerToggle', 'Overseer Toggle')
map('n', L 'or', C 'OverseerRun', 'Overseer Run')
map('n', L 'ot', C 'OverseerTaskAction', 'Overseer Task Action')
map('n', L 'os', C 'OverseerShell', 'Overseer Shell')
