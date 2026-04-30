local actions = require 'pack.actions'
local query = require 'pack.query'
local scaffold = require 'pack.scaffold'
local ui = require 'pack.ui'

local M = {}

---@param label string
---@return table
local function divider(label)
  return {
    text = ('────────── %s'):format(label),
    divider = true,
    preview = {
      text = '',
      ft = 'markdown',
      loc = false,
    },
  }
end

local scaffold_item = {
  text = '[Action] + Scaffold new package',
  action = 'scaffold',
  preview = {
    text = table.concat({
      'Create a new package scaffold.',
      '',
      'Flow:',
      '  1. Paste owner/repo or GitHub URL',
      '  2. Choose plugins or lsps',
      '  3. Confirm module name',
      '  4. Optionally create a config stub',
      '  5. Optionally add dependencies',
      '  6. Review summary and create',
    }, '\n'),
    ft = 'markdown',
    loc = false,
  },
}

local disabled_item = {
  text = '[View] Disabled packages',
  action = 'view_disabled',
  preview = {
    text = 'Show only disabled top-level packages.',
    ft = 'markdown',
    loc = false,
  },
}

local build_needed_item = {
  text = '[View] Build-needed packages',
  action = 'view_build_needed',
  preview = {
    text = 'Show packages whose build step should run again.',
    ft = 'markdown',
    loc = false,
  },
}

local orphan_item = {
  text = '[View] Orphan packages',
  action = 'view_orphans',
  preview = {
    text = 'Show installed packages that are no longer declared in specs.',
    ft = 'markdown',
    loc = false,
  },
}

local back_item = {
  text = '[Action] Back to all packages',
  action = 'back',
  preview = {
    text = 'Return to the full package list.',
    ft = 'markdown',
    loc = false,
  },
}

local action_items = {
  { text = 'Check update', value = 'check_update' },
  { text = 'Update', value = 'update' },
  { text = 'Rebuild', value = 'rebuild' },
  { text = 'Open config', value = 'open_config' },
  { text = 'Open plugin dir', value = 'open_plugin_dir' },
  { text = 'Remove', value = 'remove' },
}

---@param plugin ManagedPluginState
---@return string
local function short_rev(plugin)
  if not plugin.current_rev or plugin.current_rev == '' then
    return '-------'
  end

  return plugin.current_rev:sub(1, 7)
end

---@param plugin ManagedPluginState
---@return string
local function compact_hint(plugin)
  local flags = {}

  if plugin.pending_delete then
    flags[#flags + 1] = 'pending delete'
  end

  if not plugin.enabled then
    flags[#flags + 1] = 'off'
  end

  if plugin.has_build and plugin.build_needed then
    flags[#flags + 1] = 'build!'
  end

  if plugin.update_status == 'available' then
    flags[#flags + 1] = 'update!'
  elseif plugin.update_status == 'error' then
    flags[#flags + 1] = 'update?'
  end

  if not plugin.installed_on_disk then
    flags[#flags + 1] = 'missing'
  end

  return #flags > 0 and ('  [' .. table.concat(flags, ', ') .. ']') or ''
end

---@param plugin ManagedPluginState
---@return string
local function preview_text(plugin)
  local lines = {
    '# Package',
    '',
    ('- Name: `%s`'):format(plugin.name or '-'),
    ('- Repo: `%s`'):format(plugin.repo),
    ('- Group: `%s`'):format(plugin.group),
    ('- Source: `%s`'):format(plugin.source_url or '-'),
    ('- Config: `%s`'):format(plugin.config_path or '-'),
    ('- Plugin dir: `%s`'):format(plugin.plugin_dir),
    '',
    '## Status',
    '',
    ('- Enabled: `%s`'):format(tostring(plugin.enabled)),
    ('- Active: `%s`'):format(tostring(plugin.active)),
    ('- Installed on disk: `%s`'):format(tostring(plugin.installed_on_disk)),
    ('- Configured this session: `%s`'):format(tostring(plugin.configured)),
    ('- Update status: `%s`'):format(plugin.update_status),
    ('- Last checked: `%s`'):format(plugin.update_checked_at and os.date('%Y-%m-%d %H:%M:%S', plugin.update_checked_at) or '-'),
    ('- Update error: `%s`'):format(plugin.update_error or '-'),
    '',
    '## Git',
    '',
    ('- Current rev: `%s`'):format(plugin.current_rev or '-'),
    ('- Requested version: `%s`'):format(plugin.requested_version or '-'),
    ('- Remote ref: `%s`'):format(plugin.remote_ref or '-'),
    ('- Remote rev: `%s`'):format(plugin.remote_rev or '-'),
    ('- Known branches: `%s`'):format(plugin.branches and table.concat(plugin.branches, ', ') or '-'),
    ('- Latest tag: `%s`'):format(plugin.tags and plugin.tags[1] or '-'),
    '',
    '## Build',
    '',
    ('- Command: `%s`'):format(plugin.build or '-'),
    ('- Build needed: `%s`'):format(tostring(plugin.build_needed)),
    ('- Last build success: `%s`'):format(tostring(plugin.build_success)),
    ('- Last built commit: `%s`'):format(plugin.build_last_built_commit or '-'),
    ('- Last built time: `%s`'):format(plugin.build_last_built_time and os.date('%Y-%m-%d %H:%M:%S', plugin.build_last_built_time) or '-'),
    '',
    '## Dependencies',
    '',
  }

  if #plugin.dependency_chain == 0 then
    lines[#lines + 1] = '- No dependencies'
  else
    for _, dep in ipairs(plugin.dependency_chain) do
      lines[#lines + 1] = ('- `%s`'):format(dep)
    end
  end

  lines[#lines + 1] = ''
  lines[#lines + 1] = '## Dependents'
  lines[#lines + 1] = ''

  if #plugin.dependent_repos == 0 then
    lines[#lines + 1] = '- No dependents'
  else
    for _, dep in ipairs(plugin.dependent_repos) do
      lines[#lines + 1] = ('- `%s`'):format(dep)
    end
  end

  return table.concat(lines, '\n')
end

---@param orphan OrphanPluginState
---@return table
local function to_orphan_item(orphan)
  local status = orphan.active and 'active' or 'inactive'
  return {
    text = ('%s  [orphan]  [%s]'):format(orphan.name, status),
    orphan = orphan,
    preview = {
      text = table.concat({
        '# Orphan Package',
        '',
        ('- Name: `%s`'):format(orphan.name),
        ('- Active: `%s`'):format(tostring(orphan.active)),
        ('- Current rev: `%s`'):format(orphan.current_rev or '-'),
        ('- Source: `%s`'):format(orphan.source_url or '-'),
        ('- Requested version: `%s`'):format(orphan.requested_version or '-'),
        ('- Path: `%s`'):format(orphan.path),
      }, '\n'),
      ft = 'markdown',
      loc = false,
    },
  }
end

---@param orphan OrphanPluginState
---@return string
local function delete_orphan_summary(orphan)
  return table.concat({
    '# Delete Orphan',
    '',
    ('- Name: `%s`'):format(orphan.name),
    ('- Path: `%s`'):format(orphan.path),
    ('- Active: `%s`'):format(tostring(orphan.active)),
    '',
    '## Effect',
    '',
    '- Remove from disk and lockfile',
    '- Inactive orphans are deleted immediately',
  }, '\n')
end

---@param orphans OrphanPluginState[]
---@return string
local function delete_orphans_summary(orphans)
  local lines = {
    ('# Delete %d Orphan%s'):format(#orphans, #orphans > 1 and 's' or ''),
    '',
  }
  for _, orphan in ipairs(orphans) do
    lines[#lines + 1] = ('- `%s` (%s)'):format(orphan.name, orphan.active and 'active' or 'inactive')
  end
  vim.list_extend(lines, {
    '',
    '## Effect',
    '',
    '- Remove selected orphans from disk and lockfile',
    '- Inactive orphans are deleted immediately',
  })
  return table.concat(lines, '\n')
end

---@param orphan OrphanPluginState
---@param cb fun(ok: boolean)
local function confirm_delete_orphan(orphan, cb)
  ui.confirm({
    title = 'Delete Orphan',
    preview_text = delete_orphan_summary(orphan),
  }, cb)
end

---@param orphans OrphanPluginState[]
---@param cb fun(ok: boolean)
local function confirm_delete_orphans(orphans, cb)
  ui.confirm({
    title = ('Delete %d Orphan%s'):format(#orphans, #orphans > 1 and 's' or ''),
    preview_text = delete_orphans_summary(orphans),
  }, cb)
end

---@param plugin ManagedPluginState
---@return string
local function remove_summary(plugin)
  local dependents = query.list_dependents(plugin.repo)
  local lines = {
    '# Remove Package',
    '',
    ('- Repo: `%s`'):format(plugin.repo),
    ('- Name: `%s`'):format(plugin.name or '-'),
    ('- Group: `%s`'):format(plugin.group),
    ('- Install dir: `%s`'):format(plugin.plugin_dir),
    ('- Config: `%s`'):format(plugin.config_path or '(none)'),
    '',
  }

  if #dependents > 0 then
    lines[#lines + 1] = '## Blocked'
    lines[#lines + 1] = ''
    lines[#lines + 1] = 'This package is still referenced by:'
    lines[#lines + 1] = ''
    for _, dependent in ipairs(dependents) do
      lines[#lines + 1] = ('- `%s`'):format(dependent.repo)
    end
  else
    lines[#lines + 1] = '## Effect'
    lines[#lines + 1] = ''
    lines[#lines + 1] = '- Remove spec entry'
    lines[#lines + 1] = '- Delete config file'
    lines[#lines + 1] = '- Clear build/override/update cache'
    lines[#lines + 1] = '- Disk and lock cleanup on next startup'
    lines[#lines + 1] = '- Neovim will restart to finalize'
  end

  return table.concat(lines, '\n')
end

---@param plugin ManagedPluginState
---@param cb fun(ok: boolean)
local function confirm_remove(plugin, cb)
  ui.confirm({
    title = 'Remove Package',
    preview_text = remove_summary(plugin),
  }, cb)
end

---@param plugin ManagedPluginState
---@return table
local function to_item(plugin)
  local name = plugin.name or plugin.repo
  local prefix = plugin.group == 'lsps' and '[LSP]' or '[Plugin]'
  return {
    text = ('%s %s%s'):format(prefix, name, compact_hint(plugin)),
    plugin = plugin,
    preview = {
      text = preview_text(plugin),
      ft = 'markdown',
      loc = false,
    },
  }
end

---@param plugin ManagedPluginState
local function select_action(parent_picker, plugin)
  local items = vim.deepcopy(action_items)

  items[#items + 1] = plugin.enabled
      and { text = 'Disable', value = 'disable' }
    or { text = 'Enable', value = 'enable' }

  items = vim.tbl_filter(function(item)
    if item.value == 'rebuild' then
      return plugin.has_build
    end

    if item.value == 'open_config' then
      return plugin.config_exists
    end

    return true
  end, items)

  ui.select(items, {
    prompt = ('Package action: %s'):format(plugin.name or plugin.repo),
    format_item = function(item)
      return item.text
    end,
    snacks = {
      layout = {
        preset = 'ivy',
        fullscreen = false,
        hidden = { 'preview' },
      },
    },
  }, function(choice)
    if not choice then
      return
    end

    if choice.value == 'remove' then
      confirm_remove(plugin, function(confirmed)
        if not confirmed then
          return
        end

        parent_picker:close()
        local ok, err = actions.remove(plugin.repo)
        if not ok and err then
          vim.notify(err, vim.log.levels.ERROR)
        end
      end)
      return
    end

    parent_picker:close()
    actions[choice.value](plugin.repo)
  end)
end

function M.open()
  M.open_view 'all'
end

---@param view 'all'|'disabled'|'build_needed'|'orphans'
function M.open_view(view)
  local title = 'Packages'
  local items = {}

  if view == 'orphans' then
    title = 'Orphan Packages'
    items = vim.tbl_map(to_orphan_item, query.list_orphans())
    if #items == 0 then
      items = {
        {
          text = '[Empty] No orphan packages',
          empty = true,
          preview = {
            text = 'All installed packages are currently declared in specs.',
            ft = 'markdown',
            loc = false,
          },
        },
        back_item,
      }
    end
  else
    local plugins = query.list_manageable()
    if view == 'disabled' then
      title = 'Disabled Packages'
      plugins = vim.tbl_filter(function(plugin)
        return not plugin.enabled
      end, plugins)
    elseif view == 'build_needed' then
      title = 'Build-needed Packages'
      plugins = vim.tbl_filter(function(plugin)
        return plugin.has_build and plugin.build_needed
      end, plugins)
    end

    items = vim.tbl_map(to_item, plugins)
    table.sort(items, function(a, b)
      if a.plugin.group ~= b.plugin.group then
        return a.plugin.group < b.plugin.group
      end

      local a_name = a.plugin.name or a.plugin.repo
      local b_name = b.plugin.name or b.plugin.repo
      return a_name < b_name
    end)

    if view == 'all' then
      local package_items = items
      items = {
        divider 'Actions',
        scaffold_item,
        divider 'Views',
        disabled_item,
        build_needed_item,
        orphan_item,
        divider 'Packages',
      }

      vim.list_extend(items, package_items)
    elseif #items == 0 then
      local empty_text = view == 'disabled' and 'No disabled packages.' or 'No packages currently need a build.'
      items = {
        {
          text = ('[Empty] %s'):format(empty_text),
          empty = true,
          preview = {
            text = empty_text,
            ft = 'markdown',
            loc = false,
          },
        },
        back_item,
      }
    else
      table.insert(items, 1, divider(view == 'disabled' and 'Disabled Packages' or 'Build-needed Packages'))
    end
  end

  ui.pick {
    title = title,
    items = items,
    format = 'text',
    preview = 'preview',
    win = {
      preview = {
        wo = {
          number = false,
          relativenumber = false,
          signcolumn = 'no',
        },
      },
    },
    confirm = function(picker, item)
      if item and item.divider then
        return
      end

      if item and item.action == 'back' then
        picker:close()
        vim.schedule(function()
          M.open_view 'all'
        end)
        return
      end

      if item and item.action == 'view_disabled' then
        picker:close()
        vim.schedule(function()
          M.open_view 'disabled'
        end)
        return
      end

      if item and item.action == 'view_build_needed' then
        picker:close()
        vim.schedule(function()
          M.open_view 'build_needed'
        end)
        return
      end

      if item and item.action == 'view_orphans' then
        picker:close()
        vim.schedule(function()
          M.open_view 'orphans'
        end)
        return
      end

      if item and item.action == 'scaffold' then
        picker:close()
        vim.schedule(scaffold.open)
        return
      end

      if item and item.empty then
        return
      end

      if item and item.orphan then
        local selected = picker.selected and picker:selected({ fallback = true }) or { item }
        local orphan_selected = vim.tbl_filter(function(i)
          return i.orphan ~= nil
        end, selected)

        if #orphan_selected >= 2 then
          local orphans = vim.tbl_map(function(i)
            return i.orphan
          end, orphan_selected)
          confirm_delete_orphans(orphans, function(confirmed)
            if confirmed then
              picker:close()
              for _, o in ipairs(orphans) do
                actions.delete_orphan(o.name)
              end
            end
          end)
          return
        end

        local orphan = item.orphan
        local orphan_items = {
          { text = 'Delete orphan', value = 'delete' },
          { text = 'Open plugin dir', value = 'open' },
        }
        ui.select(orphan_items, {
          prompt = ('Orphan action: %s'):format(orphan.name),
          format_item = function(it)
            return it.text
          end,
          snacks = {
            layout = {
              preset = 'ivy',
              fullscreen = false,
              hidden = { 'preview' },
            },
          },
        }, function(choice)
          if not choice then
            return
          end

          if choice.value == 'delete' then
            confirm_delete_orphan(orphan, function(confirmed)
              if confirmed then
                picker:close()
                actions.delete_orphan(orphan.name)
              end
            end)
          elseif choice.value == 'open' then
            picker:close()
            vim.cmd('edit ' .. vim.fn.fnameescape(orphan.path))
          end
        end)
        return
      end

      if item and item.plugin then
        select_action(picker, item.plugin)
      end
    end,
  }
end

return M
