local M = {}

function M.open_picker()
  require('pack.picker').open()
end

function M.scaffold()
  require('pack.scaffold').open()
end

return M
