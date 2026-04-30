local keymap = require 'utils.keymap'
local L = keymap.leader
local C = keymap.cmd
local map = keymap.map

local appearance = require 'concerns.appearance'
local debug = require 'concerns.debug'
local formatting = require 'concerns.formatting'
local git = require 'concerns.git'
local language = require 'concerns.language'
local navigation = require 'concerns.navigation'
local notes = require 'concerns.notes'
local packages = require 'concerns.packages'
local platform = require 'concerns.platform'
local search = require 'concerns.search'
local tasks = require 'concerns.tasks'

-- file & buffer
map('n', L 'w', C 'write', 'Write buffer')
map('n', L 'q', C 'quit', 'Quit window')
map('n', L 'Q', C 'wqa', 'Write and quit all')
map('n', L 'e', navigation.explorer, 'Open file explorer')
map('n', L 'E', navigation.explorer_float, 'Open file explorer (float)')
map({ 'n', 'v', 'x' }, L 's', C 'e #', 'Edit alternate file')
map({ 'n', 'v', 'x' }, L 'S', C 'bot sf #', 'Split and edit alternate file')
map('n', L 'z', navigation.zen, 'Toggle ZenMode')
map('n', L 'fp', C 'let @+=@%', 'Copy Path')

-- picker
map('n', L '<space>', search.buffers, 'Find buffers')
map('n', L 'pf', search.files, 'Find files')
map('n', L 'ph', search.help, 'Find help')
map('n', L 'pr', search.recent, 'Find recent files')
map('n', L 'pl', search.picker_list, 'Show picker list')
map('n', L 'pp', packages.open_picker, 'Manage packages')
map('n', L 'pP', packages.scaffold, 'Scaffold package')

map('n', L 'g', search.grep_live, 'Grep live')
map({ 'n', 'v' }, L 'fw', search.grep_word, 'Grep word under cursor')
map('n', L 'fW', search.grep_cword, 'Grep WORD under cursor')

-- lsp
map('n', L 'cr', language.rename_symbol, 'Rename symbol')
map('n', L 'cR', language.rename_file, 'Rename file')
map('n', L 'ca', language.code_action, 'Code action')
map('n', 'gd', language.definition, 'Go to definition')
map('n', 'gr', search.references, 'Go to references', { nowait = true })
map({ 'n', 't' }, '[[', navigation.prev_reference, 'Previous reference')
map({ 'n', 't' }, ']]', navigation.next_reference, 'Next reference')
map('n', 'gl', language.diagnostics_float, 'Show diagnostics')
map('n', 'dn', language.diagnostic_next, 'Next diagnostic')
map('n', 'dp', language.diagnostic_prev, 'Previous diagnostic')
map('n', L 'ss', search.symbols, 'LSP symbols')
map('n', L 'sS', search.workspace_symbols, 'LSP workspace symbols')
map('n', L 'lf', formatting.format_buffer, 'Format buffer')
map('n', '<C-l>', 'zo', 'Open the fold at the cursor.')
map('n', '<C-h>', 'zc', 'Close the fold at the cursor.')

-- editing
map('n', L 'ip', notes.paste_image, 'Paste image from clipboard')
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
map('n', L 'cs', appearance.pick_colorscheme, 'Pick colorscheme')
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
map('n', L 'tv', platform.terminal_right, 'Toggle terminal (vertical)')
map('n', L 'th', platform.terminal_bottom, 'Toggle terminal (horizontal)')
map('n', L 'ta', platform.attach_terminal_to_buffer, 'Attach Terminal to Current Buffer')
map('n', L 'td', platform.detach_terminal, 'Detach Terminal from Current Buffer')
map('t', 'tq', '<C-\\><C-n>', 'Change to normal mode in terminal')

-- plugin:vimwiki
map('n', '\\ww', '<Plug>VimwikiIndex', 'Go to WikiIndex')
map('n', '\\wi', '<Plug>VimwikiDiaryIndex', 'Go to DiaryIndex')
map('n', '\\w\\w', '<Plug>VimwikiMakeDiaryNote', 'Create a Diary Note')
map('n', '\\w\\g', '<Plug>VimwikiDiaryGenerateLinks', 'Generate Links for Diary Notes')
map('n', '\\]', '<Plug>VimwikiToggleListItem', 'Toggle List Item')

-- plugin:vimwiki (search with snacks.picker)
map('n', L 'wf', notes.wiki_notes, 'Find wiki notes')

map('n', L 'wg', notes.grep_wiki_notes, 'Grep wiki notes')

-- plugin:lazygit
map('n', L 'lg', git.open_lazygit, 'Open LazyGit', { silent = true })
map('n', L 'gd', git.diff, 'Git diff')

-- plugin:snacks.gh
map('n', L 'gp', git.pull_requests, 'GitHub pull requests (open)')
map('n', L 'gP', git.pull_requests_all, 'GitHub pull requests (all)')

-- plugin:dap
map('n', L 'dc', debug.continue, 'Run/Continue')
map('n', L 'db', debug.toggle_breakpoint, 'Toggle Breakpoint')
map('n', L 'di', debug.step_into, 'Step Into')
map('n', L 'do', debug.step_over, 'Step Over')
map('n', L 'dO', debug.step_out, 'Step Out')
map('n', L 'dt', debug.terminate, 'Terminate')

-- plugin:dap-view
map('n', L 'dv', debug.toggle_view, 'Toggle Debug View')

-- plugin:flutter-tools
map('n', L 'Fl', debug.flutter_run, 'Flutter Run')
map('n', L 'Fq', debug.flutter_quit, 'Flutter Quit')
map('n', L 'Fo', debug.flutter_reload, 'Flutter Reload')
map('n', L 'Fr', debug.flutter_restart, 'Flutter Restart')
map('n', L 'Fb', debug.flutter_pub_get, 'Flutter PubGet')
map('n', L 'Fg', debug.flutter_codegen, 'Flutter Code Generate')

-- plugin:flash
map({ 'n', 'x', 'o' }, 'm', navigation.flash_jump, 'Flash')
map({ 'n', 'x', 'o' }, 'M', navigation.flash_treesitter, 'Flash Treesitter')
map('o', 'r', navigation.flash_remote, 'Remote Flash')
map({ 'x', 'o' }, 'R', navigation.flash_treesitter_search, 'Treesitter Search')
map('c', '<C-s>', navigation.flash_toggle_search, 'Toggle Flash Search')

-- plugin:overseer
map('n', L 'oo', tasks.toggle, 'Overseer Toggle')
map('n', L 'or', tasks.run, 'Overseer Run')
map('n', L 'ot', tasks.task_action, 'Overseer Task Action')
map('n', L 'os', tasks.shell, 'Overseer Shell')
