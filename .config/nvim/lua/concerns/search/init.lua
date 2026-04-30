local snacks = require 'snacks'

local M = {}

function M.buffers()
  snacks.picker.buffers()
end

function M.files()
  snacks.picker.files { hidden = true }
end

function M.help()
  snacks.picker.help()
end

function M.recent()
  snacks.picker.recent()
end

function M.picker_list()
  snacks.picker()
end

function M.grep_live()
  snacks.picker.grep { hidden = true }
end

function M.grep_word()
  snacks.picker.grep_word()
end

function M.grep_cword()
  snacks.picker.grep {
    regex = false,
    live = false,
    search = vim.fn.expand '<cWORD>',
  }
end

function M.references()
  snacks.picker.lsp_references()
end

function M.symbols()
  snacks.picker.lsp_symbols()
end

function M.workspace_symbols()
  snacks.picker.lsp_workspace_symbols()
end

function M.git_diff()
  snacks.picker.git_diff()
end

function M.gh_pr(state)
  snacks.picker.gh_pr(state and { state = state } or nil)
end

return M
