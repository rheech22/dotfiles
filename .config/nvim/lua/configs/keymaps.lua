local keymap = require 'utils.keymap'
local leader = keymap.leader
local cmd = keymap.cmd
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

map('n', leader 'p', packages.open_picker, 'Manage packages')
map('n', leader 'C', appearance.pick_colorscheme, 'Pick colorscheme')
map('n', leader 'F', formatting.format_buffer, 'Format buffer')

map('n', leader 'c', navigation.copy_path, 'Copy path')
map('n', leader 'e', navigation.explorer, 'Open file explorer')
map('n', leader 'k', navigation.keymaps, 'Show keymaps')
map('nxo', 'm', navigation.flash_jump, 'Flash')
map('nxo', 'M', navigation.flash_treesitter, 'Flash Treesitter')
map('o', 'r', navigation.flash_remote, 'Remote Flash')
map('xo', 'R', navigation.flash_treesitter_search, 'Treesitter Search')
map('c', '<C-s>', navigation.flash_toggle_search, 'Toggle Flash Search')
map('nt', '[[', navigation.prev_reference, 'Previous reference')
map('nt', ']]', navigation.next_reference, 'Next reference')
map('n', leader 'z', navigation.zen, 'Toggle Zen Mode')

map('n', leader '<space>', search.buffers, 'Find buffers')
map('n', leader 'h', search.help, 'Find help')
map('n', leader 'l', search.picker_list, 'Show picker list')
map('n', leader 'g', search.grep_live, 'Grep live')
map('n', leader 'f', search.files, 'Find files')
map('nv', 'gw', search.grep_word, 'Grep word under cursor')
map('n', 'gW', search.grep_cword, 'Grep WORD under cursor')
map('n', 'gr', search.references, 'Go to references', { nowait = true })
map('n', leader 'y', search.symbols, 'LSP symbols')
map('n', leader 'Y', search.workspace_symbols, 'LSP workspace symbols')

map('n', leader 'r', language.rename_symbol, 'Rename symbol')
map('n', leader 'R', language.rename_file, 'Rename file')
map('n', leader 'a', language.code_action, 'Code action')
map('n', 'gd', language.definition, 'Go to definition')
map('n', 'dl', language.diagnostics_float, 'Show diagnostics')
map('n', 'dn', language.diagnostic_next, 'Next diagnostic')
map('n', 'dp', language.diagnostic_prev, 'Previous diagnostic')

map('nvx', leader 'o', platform.source_config, 'Source ' .. vim.fn.expand '$MYVIMRC')
map('nvx', leader 'O', cmd 'restart', 'Restart vim.')
map('nvx', leader 'w', platform.save, 'Write buffer')
map('nvx', leader 'q', cmd 'quit', 'Quit window')
map('nvx', leader 'Q', cmd 'wqa', 'Write and quit all')
map('nvx', leader 's', cmd 'e #', 'Edit alternate file')
map('nvx', leader 'S', cmd 'topleft vs #', 'Split and edit alternate file')

map('nv', 'U', '<C-r>', 'Redo')
map('nv', '<C-w>', platform.toggle_wrap, 'Toggle wrap')
map('nv', '<C-l>', 'zo', 'Open the fold at the cursor.')
map('nv', '<C-h>', 'zc', 'Close the fold at the cursor.')
map('nv', '<C-k>', '<C-u>zz', 'Scroll up and center')
map('nv', '<C-j>', '<C-d>zz', 'Scroll down and center')
map('n', '<C-f>', cmd 'Open .', 'Open current directory in Finder.')
map('n', 'n', 'nzzzv', 'Next search result and center')
map('n', 'N', 'Nzzzv', 'Previous search result and center')

map('n', 'ss', cmd 'split', 'Split horizontal', { noremap = true, silent = true })
map('n', 'sv', cmd 'vsplit', 'Split vertical', { noremap = true, silent = true })
map('n', 'sk', '<C-w>k', 'Focus pane above')
map('n', 'sh', '<C-w>h', 'Focus pane left')
map('n', 'sj', '<C-w>j', 'Focus pane below')
map('n', 'sl', '<C-w>l', 'Focus pane right')
map('n', 'sq', '<C-w>q', 'Close pane')
map('n', '<C-w><left>', '<C-w><', 'Decrease pane width')
map('n', '<C-w><right>', '<C-w>>', 'Increase pane width')
map('n', '<C-w><up>', '<C-w>+', 'Increase pane height')
map('n', '<C-w><down>', '<C-w>-', 'Decrease pane height')

map('n', '<C-,>', platform.terminal_float, 'Toggle terminal (float)')
map('n', ',,', platform.select_terminal, 'Select terminal')
map('n', leader 'tv', platform.terminal_right, 'Toggle terminal (vertical)')
map('n', leader 'th', platform.terminal_bottom, 'Toggle terminal (horizontal)')
map('nv', leader 'tl', platform.send_lines, 'Send lines to terminal')
map('v', leader 'ts', platform.send_selection, 'Send selection to terminal')
map('t', 'tq', '<C-\\><C-n>', 'Change to normal mode in terminal')

vim.api.nvim_create_autocmd('TermOpen', {
  pattern = 'term://*toggleterm#*',
  callback = function()
    local buf = vim.api.nvim_get_current_buf()
    local opts = { buffer = buf }

    vim.keymap.set('t', '<C-,>', platform.terminal_float, opts)
    vim.keymap.set('t', '<C-l>', function()
      platform.cycle_float 'next'
    end, opts)
    vim.keymap.set('t', '<C-h>', function()
      platform.cycle_float 'prev'
    end, opts)
    vim.keymap.set('t', '<C-n>', platform.new_float_term, opts)
    vim.keymap.set('t', '<C-q>', platform.close_float_term, opts)
  end,
})

map('n', '\\ww', notes.wiki_index, 'Go to WikiIndex')
map('n', '\\wi', notes.diary_index, 'Go to DiaryIndex')
map('n', '\\w\\w', notes.make_diary_note, 'Create a Diary Note')
map('n', '\\w\\g', notes.diary_generate_links, 'Generate Links for Diary Notes')
map('n', '\\]', notes.toggle_list_item, 'Toggle List Item')
map('n', leader 'wf', notes.wiki_notes, 'Find wiki notes')
map('n', leader 'wg', notes.grep_wiki_notes, 'Grep wiki notes')
map('n', leader 'ip', notes.paste_image, 'Paste image from clipboard')

map('n', leader 'L', git.open_lazygit, 'Open LazyGit', { silent = true })
map('n', leader 'D', git.diff, 'Git diff')
map('n', leader 'P', git.pull_requests, 'GitHub pull requests (open)')
map('n', leader 'G', git.pull_requests_all, 'GitHub pull requests (all)')

map('n', leader 'dc', debug.continue, 'Run/Continue')
map('n', leader 'db', debug.toggle_breakpoint, 'Toggle Breakpoint')
map('n', leader 'di', debug.step_into, 'Step Into')
map('n', leader 'do', debug.step_over, 'Step Over')
map('n', leader 'dO', debug.step_out, 'Step Out')
map('n', leader 'dt', debug.terminate, 'Terminate')
map('n', leader 'dv', debug.toggle_view, 'Toggle Debug View')

map('n', leader 'oo', tasks.toggle, 'Tasks Toggle')
map('n', leader 'or', tasks.run, 'Tasks Run')
map('n', leader 'ot', tasks.task_action, 'Tasks Action')
map('n', leader 'os', tasks.shell, 'Tasks Shell')
