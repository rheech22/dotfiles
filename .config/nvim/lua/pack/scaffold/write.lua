local derive = require 'pack.scaffold.derive'
local render = require 'pack.scaffold.render'

local M = {}

---@param path string
---@return string[]
local function read_lines(path)
  return vim.fn.readfile(path)
end

---@param path string
---@param lines string[]
local function write_lines(path, lines)
  vim.fn.writefile(lines, path)
end

---@param path string
local function format_lua(path)
  if vim.fn.executable 'stylua' ~= 1 then
    return
  end

  vim.system({ 'stylua', path }, { text = true }):wait()
end

---@param group 'plugins'|'lsps'
---@param spec { repo: string, name: string, concern?: string, deps?: string[] }
---@return string|nil
function M.append_spec(group, spec)
  local path = derive.spec_path(group)
  local lines = read_lines(path)
  local insert_at = nil

  for idx = #lines, 1, -1 do
    if lines[idx]:match '^}%s*$' then
      insert_at = idx
      break
    end
  end

  if not insert_at then
    return 'Failed to find end of spec table'
  end

  local entry = render.spec_entry(spec)
  for offset, line in ipairs(entry) do
    table.insert(lines, insert_at + offset - 1, line)
  end

  write_lines(path, lines)
  format_lua(path)
  return nil
end

---@param group 'plugins'|'lsps'
---@param name string
---@param concern string|nil
---@return string|nil, string
function M.create_config(group, name, concern)
  local path = derive.config_path(group, name, concern)
  vim.fn.mkdir(vim.fn.fnamemodify(path, ':h'), 'p')
  write_lines(path, render.config_stub(name))
  format_lua(path)
  return nil, path
end

---@param group 'plugins'|'lsps'
---@param repo string
---@return string|nil
function M.remove_spec(group, repo)
  local path = derive.spec_path(group)
  local lines = read_lines(path)
  local depth = 0
  local start_idx = nil
  local entry_lines = {}
  local matched_repo = false

  local function brace_delta(line)
    local opens = select(2, line:gsub('{', ''))
    local closes = select(2, line:gsub('}', ''))
    return opens - closes
  end

  for idx, line in ipairs(lines) do
    local prev_depth = depth
    if not start_idx and prev_depth == 1 and line:match '^%s*{' then
      start_idx = idx
      entry_lines = {}
      matched_repo = false
    end

    if start_idx then
      entry_lines[#entry_lines + 1] = line
      local entry_prev_depth = depth - 1
      if (entry_prev_depth == 0 or entry_prev_depth == 1)
          and (line:find("repo%s*=%s*'" .. vim.pesc(repo) .. "'") or line:find('repo%s*=%s*"' .. vim.pesc(repo) .. '"')) then
        matched_repo = true
      end
    end

    depth = depth + brace_delta(line)

    if start_idx and depth == 1 then
      if matched_repo then
        for remove_idx = idx, start_idx, -1 do
          table.remove(lines, remove_idx)
        end
        write_lines(path, lines)
        format_lua(path)
        return nil
      end

      start_idx = nil
      entry_lines = {}
      matched_repo = false
    end
  end

  return ('Spec entry not found for %s'):format(repo)
end

return M
