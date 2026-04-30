local M = {}

---@param input string
---@return string|nil, string|nil
function M.repo(input)
  local value = vim.trim(input or '')
  if value == '' then
    return nil, 'Repository is required'
  end

  value = value:gsub('/+$', '')
  value = value:gsub('%.git$', '')
  value = value:gsub('^https?://github%.com/', '')
  value = value:gsub('^git@github%.com:', '')

  if not value:match('^[^/]+/[^/]+$') then
    return nil, 'Expected owner/repo or GitHub URL'
  end

  return value, nil
end

return M
