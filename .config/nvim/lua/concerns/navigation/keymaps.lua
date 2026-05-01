local M = {}

function M.open()
  local modes = { 'n', 'v', 'x', 's', 't', 'c', 'o', 'i' }
  local by_lhs = {}

  for _, mode in ipairs(modes) do
    local ok, maps = pcall(vim.api.nvim_get_keymap, mode)
    if ok then
      for _, m in ipairs(maps) do
        if m.desc and m.desc ~= '' then
          local lhs = m.lhs
          if not by_lhs[lhs] then
            by_lhs[lhs] = { lhs = lhs, rhs = m.rhs or '', desc = m.desc, modes = {} }
          end
          by_lhs[lhs].modes[mode] = true
        end
      end
    end
  end

  local keymaps_file = vim.fn.stdpath 'config' .. '/lua/configs/keymaps.lua'

  local items = {
    {
      text = '[Action] Edit keymaps.lua',
      action = 'edit_keymaps',
      sort_key = '!',
    },
  }
  for _, entry in pairs(by_lhs) do
    local mode_str = {}
    for m in pairs(entry.modes) do
      mode_str[#mode_str + 1] = m
    end
    table.sort(mode_str)
    local modes_display = table.concat(mode_str)

    local display_lhs = entry.lhs
    local leader = vim.g.mapleader or ' '
    if display_lhs:sub(1, #leader) == leader then
      display_lhs = '<leader>' .. display_lhs:sub(#leader + 1)
    end
    display_lhs = display_lhs:gsub(' ', '<space>')

    local is_leader = entry.lhs:match '^<leader>' or entry.lhs:match '^\\'

    items[#items + 1] = {
      text = ('  %-5s  %-20s  %s'):format(modes_display, display_lhs, entry.desc),
      lhs = entry.lhs,
      display_lhs = display_lhs,
      desc = entry.desc,
      rhs = entry.rhs,
      modes = modes_display,
      sort_key = (is_leader and '0' or '1') .. entry.lhs,
    }
  end

  table.sort(items, function(a, b)
    return a.sort_key < b.sort_key
  end)

  local ui = require 'pack.ui'
  ui.pick {
    title = 'Keymaps',
    items = items,
    format = 'text',
    layout = {
      preset = 'ivy',
      fullscreen = false,
      hidden = { 'preview' },
    },
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
      if not item then
        return
      end
      picker:close()
      if item.action == 'edit_keymaps' then
        vim.cmd('edit ' .. vim.fn.fnameescape(keymaps_file))
      end
    end,
  }
end

return M
