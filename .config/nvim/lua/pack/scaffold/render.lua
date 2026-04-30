local M = {}

---@param spec { repo: string, name: string, concern?: string, deps?: string[] }
---@return string[]
function M.spec_entry(spec)
  if not spec.deps or vim.tbl_isempty(spec.deps) then
    local fields = {
      'name = ' .. string.format('%q', spec.name),
      'repo = ' .. string.format('%q', spec.repo),
    }
    if spec.concern then
      fields[#fields + 1] = 'concern = ' .. string.format('%q', spec.concern)
    end

    return {
      '  { ' .. table.concat(fields, ', ') .. ' },',
    }
  end

  local lines = {
    '  {',
    '    name = ' .. string.format('%q', spec.name) .. ',',
    '    repo = ' .. string.format('%q', spec.repo) .. ',',
  }

  if spec.concern then
    lines[#lines + 1] = '    concern = ' .. string.format('%q', spec.concern) .. ','
  end

  lines[#lines + 1] = '    deps = {'

  for _, dep in ipairs(spec.deps) do
    lines[#lines + 1] = '      ' .. string.format('%q', dep) .. ','
  end

  lines[#lines + 1] = '    },'
  lines[#lines + 1] = '  },'
  return lines
end

---@param name string
---@return string[]
function M.config_stub(name)
  return {
    'return {',
    '  config = function()',
    '  end,',
    '}',
  }
end

---@param summary { repo: string, name: string, concern: string|nil, group: string, spec_path: string, config_path: string|nil, create_config: boolean, deps: string[] }
---@return string
function M.summary(summary)
  local lines = {
    '# Scaffold Summary',
    '',
    '## Package',
    '',
    ('- Repo: `%s`'):format(summary.repo),
    ('- Name: `%s`'):format(summary.name),
    ('- Concern: `%s`'):format(summary.concern or '-'),
    ('- Group: `%s`'):format(summary.group),
    ('- Spec: `%s`'):format(summary.spec_path),
    ('- Config: `%s`'):format(summary.config_path or '(skip)'),
    '',
    '## Dependencies',
    '',
  }

  if vim.tbl_isempty(summary.deps) then
    lines[#lines + 1] = '- None'
  else
    for _, dep in ipairs(summary.deps) do
      lines[#lines + 1] = ('- `%s`'):format(dep)
    end
  end

  lines[#lines + 1] = ''
  lines[#lines + 1] = 'Create this scaffold?'

  return table.concat(lines, '\n')
end

return M
