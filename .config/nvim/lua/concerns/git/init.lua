local snacks = require 'snacks'

local M = {}

function M.open_lazygit()
  snacks.lazygit()
end

function M.diff()
  require('concerns.search').git_diff()
end

function M.pull_requests(state)
  require('concerns.search').gh_pr(state)
end

function M.pull_requests_all()
  M.pull_requests 'all'
end

return M
