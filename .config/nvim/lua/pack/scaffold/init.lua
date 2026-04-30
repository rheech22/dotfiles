local derive = require 'pack.scaffold.derive'
local concerns = require 'pack.concerns'
local parse = require 'pack.scaffold.parse'
local render = require 'pack.scaffold.render'
local ui = require 'pack.ui'
local validate = require 'pack.scaffold.validate'
local write = require 'pack.scaffold.write'

local M = {}

---@class PackScaffoldRequest
---@field repo string
---@field name string
---@field concern string|nil
---@field group 'plugins'|'lsps'
---@field create_config boolean
---@field deps string[]

---@param prompt string
---@param default string|nil
---@param cb fun(value: string|nil)
local function input(prompt, default, cb)
  vim.ui.input({ prompt = prompt, default = default }, function(value)
    if not value or vim.trim(value) == '' then
      cb(nil)
      return
    end

    cb(vim.trim(value))
  end)
end

---@param cb fun(group: 'plugins'|'lsps'|nil)
local function select_group(cb)
  vim.ui.select({ 'plugins', 'lsps' }, {
    prompt = 'PackScaffold group',
    format_item = function(item)
      return item
    end,
  }, cb)
end

---@param cb fun(concern: string|nil)
local function select_concern(cb)
  local items = vim.tbl_map(function(concern)
    return { label = concern, value = concern }
  end, concerns.names)

  vim.ui.select(items, {
    prompt = 'PackScaffold concern',
    format_item = function(item)
      return item.label
    end,
  }, function(choice)
    cb(choice and choice.value or nil)
  end)
end

---@param cb fun(create_config: boolean|nil)
local function select_config_mode(cb)
  vim.ui.select({
    { label = 'Create config stub', value = true },
    { label = 'Skip config stub', value = false },
  }, {
    prompt = 'PackScaffold config',
    format_item = function(item)
      return item.label
    end,
  }, function(choice)
    cb(choice and choice.value or nil)
  end)
end

---@param text string
---@param cb fun(ok: boolean)
local function confirm(text, cb)
  ui.confirm({
    title = 'Scaffold Summary',
    preview_text = text,
  }, cb)
end

---@param choices { label: string, value: string }[]
---@param prompt string
---@param cb fun(value: string|nil)
local function select_choice(choices, prompt, cb)
  vim.ui.select(choices, {
    prompt = prompt,
    format_item = function(item)
      return item.label
    end,
  }, function(choice)
    cb(choice and choice.value or nil)
  end)
end

---@param request PackScaffoldRequest
---@param spec_path string
---@param config_path string|nil
local function next_step(request, spec_path, config_path)
  local choices = {
    { label = 'Open spec', value = 'spec' },
    { label = 'Finish', value = 'finish' },
  }

  if config_path then
    table.insert(choices, 1, { label = 'Open config', value = 'config' })
  end

  select_choice(choices, 'PackScaffold next step', function(choice)
    if choice == 'config' and config_path then
      vim.cmd('edit ' .. vim.fn.fnameescape(config_path))
    elseif choice == 'spec' then
      vim.cmd('edit ' .. vim.fn.fnameescape(spec_path))
    end
  end)
end

---@param deps string[]
---@return string
local function deps_label(deps)
  if vim.tbl_isempty(deps) then
    return 'Dependencies: none'
  end

  return ('Dependencies (%d): %s'):format(#deps, table.concat(deps, ', '))
end

---@param request PackScaffoldRequest
---@param cb fun(request: PackScaffoldRequest|nil)
local function collect_dependencies(request, cb)
  local choices = {
    { label = 'Add dependency', value = 'add' },
    { label = 'Remove last dependency', value = 'remove' },
    { label = 'Done', value = 'done' },
  }

  select_choice(choices, deps_label(request.deps), function(choice)
    if choice == nil or choice == 'done' then
      cb(request)
      return
    end

    if choice == 'remove' then
      if vim.tbl_isempty(request.deps) then
        vim.notify('No dependencies to remove', vim.log.levels.INFO)
      else
        local removed = table.remove(request.deps)
        vim.notify(('Removed dependency: %s'):format(removed), vim.log.levels.INFO)
      end
      collect_dependencies(request, cb)
      return
    end

    input('Dependency repo or GitHub URL: ', nil, function(raw_dep)
      if not raw_dep then
        collect_dependencies(request, cb)
        return
      end

      local dep, dep_err = parse.repo(raw_dep)
      if not dep then
        vim.notify(dep_err, vim.log.levels.ERROR)
        collect_dependencies(request, cb)
        return
      end

      if vim.tbl_contains(request.deps, dep) then
        vim.notify(('Dependency already added: %s'):format(dep), vim.log.levels.WARN)
        collect_dependencies(request, cb)
        return
      end

      request.deps[#request.deps + 1] = dep
      vim.notify(('Added dependency: %s'):format(dep), vim.log.levels.INFO)
      collect_dependencies(request, cb)
    end)
  end)
end

---@param request PackScaffoldRequest
local function finalize(request)
  local spec_path = derive.spec_path(request.group)
  local config_path = request.create_config and derive.config_path(request.group, request.name, request.concern) or nil
  local ok, err = validate.request(request.repo, request.name, request.group, request.concern, request.create_config, request.deps)
  if not ok then
    vim.notify(err, vim.log.levels.ERROR)
    return
  end

  local summary = render.summary {
    repo = request.repo,
    name = request.name,
    concern = request.concern,
    group = request.group,
    spec_path = spec_path,
    config_path = config_path,
    create_config = request.create_config,
    deps = request.deps,
  }

  confirm(summary, function(confirmed)
    if not confirmed then
      return
    end

    local spec_err = write.append_spec(request.group, {
      repo = request.repo,
      name = request.name,
      concern = request.concern,
      deps = request.deps,
    })

    if spec_err then
      vim.notify(spec_err, vim.log.levels.ERROR)
      return
    end

    local created_config_path = nil
    if request.create_config then
      local config_err, path = write.create_config(request.group, request.name, request.concern)
      if config_err then
        vim.notify(config_err, vim.log.levels.ERROR)
        return
      end
      created_config_path = path
    end

    vim.notify(('Scaffolded %s'):format(request.repo), vim.log.levels.INFO)
    next_step(request, spec_path, created_config_path)
  end)
end

function M.open()
  input('PackScaffold repository: ', nil, function(raw_repo)
    if not raw_repo then
      return
    end

    local repo, repo_err = parse.repo(raw_repo)
    if not repo then
      vim.notify(repo_err, vim.log.levels.ERROR)
      return
    end

    select_group(function(group)
      if not group then
        return
      end

      local suggested_name = derive.name(repo)
      input('PackScaffold module name: ', suggested_name, function(name)
        if not name then
          return
        end

        select_config_mode(function(create_config)
          if create_config == nil then
            return
          end

          select_concern(function(concern)
            if concern == nil then
              return
            end

            collect_dependencies({
              repo = repo,
              name = name,
              concern = concern,
              group = group,
              create_config = create_config,
              deps = {},
            }, function(request)
              if not request then
                return
              end

              finalize(request)
            end)
          end)
        end)
      end)
    end)
  end)
end

function M.setup()
  vim.api.nvim_create_user_command('PackScaffold', function()
    M.open()
  end, { desc = 'Scaffold a plugin spec and config stub' })
end

return M
