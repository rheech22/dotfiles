local M = {}

function M.toggle()
  vim.cmd 'OverseerToggle'
end

function M.run()
  vim.cmd 'OverseerRun'
end

function M.task_action()
  vim.cmd 'OverseerTaskAction'
end

function M.shell()
  vim.cmd 'OverseerShell'
end

return M
