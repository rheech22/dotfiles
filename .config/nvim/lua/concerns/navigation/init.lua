local M = {}

function M.explorer()
  vim.cmd 'Oil'
end

function M.explorer_float()
  require('oil').open_float()
end

function M.zen()
  require('snacks').zen()
end

function M.prev_reference()
  require('snacks').words.jump(-vim.v.count1)
end

function M.next_reference()
  require('snacks').words.jump(vim.v.count1)
end

function M.flash_jump()
  require('flash').jump()
end

function M.flash_treesitter()
  require('flash').treesitter()
end

function M.flash_remote()
  require('flash').remote()
end

function M.flash_treesitter_search()
  require('flash').treesitter_search()
end

function M.flash_toggle_search()
  require('flash').toggle()
end

function M.copy_path()
  local path = vim.fn.expand('%:p')
  vim.fn.setreg('+', path)
  vim.notify(('Copied: %s'):format(path), vim.log.levels.INFO)
end

function M.keymaps()
  require('concerns.navigation.keymaps').open()
end

return M
