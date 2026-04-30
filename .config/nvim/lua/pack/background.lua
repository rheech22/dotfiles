local M = {}

local remote = require 'pack.remote'

local running = false

local function refresh_statusline()
  pcall(function()
    require('lualine').refresh()
  end)
end

local function manageable_plugins()
  return require('pack.query').list_manageable()
end

function M.refresh_stale()
  if running then
    return
  end

  running = true
  refresh_statusline()
  remote.refresh_stale_async(manageable_plugins(), {
    ttl_seconds = remote.default_ttl_seconds(),
    concurrency = 3,
    on_done = function()
      running = false
      refresh_statusline()
    end,
  })
end

function M.is_running()
  return running
end

function M.setup()
  local group = vim.api.nvim_create_augroup('PackBackgroundUpdates', { clear = true })

  vim.api.nvim_create_autocmd('VimEnter', {
    group = group,
    callback = function()
      vim.defer_fn(M.refresh_stale, 5000)
    end,
  })

  vim.api.nvim_create_autocmd('FocusGained', {
    group = group,
    callback = function()
      M.refresh_stale()
    end,
  })
end

return M
