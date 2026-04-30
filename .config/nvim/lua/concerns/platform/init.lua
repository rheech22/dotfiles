local snacks = require 'snacks'

local M = {}

function M.terminal_right()
  snacks.terminal(nil, {
    win = { style = 'terminal_right' },
    count = 1,
  })
end

function M.terminal_bottom()
  snacks.terminal(nil, {
    win = { style = 'terminal_bottom' },
    count = 2,
  })
end

function M.attach_terminal_to_buffer()
  local dir = vim.fn.expand '%:p:h'
  vim.cmd('cd ' .. vim.fn.fnameescape(dir))
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.bo[buf].buftype == 'terminal' then
      local chan = vim.bo[buf].channel
      if chan and chan > 0 then
        vim.fn.chansend(chan, 'cd ' .. vim.fn.shellescape(dir) .. '\n')
      end
    end
  end
  vim.notify('cwd → ' .. dir, vim.log.levels.INFO)
end

function M.detach_terminal()
  vim.cmd('cd ' .. vim.fn.fnameescape(vim.fn.getcwd(-1, -1)))
  vim.notify('cwd reset to global', vim.log.levels.INFO)
end

return M
