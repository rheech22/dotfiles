local M = {}

function M.toggle_flash_search()
  require('concerns.navigation').flash_toggle_search()
end

return M
