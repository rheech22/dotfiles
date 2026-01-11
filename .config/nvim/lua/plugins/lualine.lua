return {
  config = function()
    local lualine = require 'lualine'

    local Colors = require 'utils.colors'
    local base = Colors.palette()
    local bg = base.bg
    local function tone(hex)
      return Colors.blend(hex, bg, 0.25)
    end

    local colors = {
      bg = bg,
      fg = base.fg,
      red = tone(base.red),
      green = tone(base.green),
      blue = tone(base.blue),
      violet = tone(base.violet),
      cyan = tone(base.cyan),
      yellow = tone(base.yellow),
      orange = tone(base.orange),
      magenta = tone(base.magenta),
    }

    local mode_map = {
      n = 'NORMAL',
      i = 'INSERT',
      v = 'VISUAL',
      V = 'V-LINE',
      ['\22'] = 'V-BLOCK',
      c = 'COMMAND',
      no = 'NORMAL',
      s = 'SELECT',
      S = 'S-LINE',
      ['\19'] = 'S-BLOCK',
      ic = 'INSERT',
      R = 'REPLACE',
      Rv = 'V-REPLACE',
      cv = 'COMMAND',
      ce = 'COMMAND',
      r = 'REPLACE',
      rm = 'REPLACE',
      t = 'TERMINAL',
    }

    local mode_colors = {
      n = colors.red,
      i = colors.green,
      v = colors.blue,
      V = colors.blue,
      ['\22'] = colors.blue,
      c = colors.magenta,
      no = colors.red,
      s = colors.orange,
      S = colors.orange,
      ['\19'] = colors.orange,
      ic = colors.yellow,
      R = colors.violet,
      Rv = colors.violet,
      cv = colors.red,
      ce = colors.red,
      r = colors.cyan,
      rm = colors.cyan,
      t = colors.red,
    }

    local function get_mode_color(default_color, bold)
      return function()
        local opts = { fg = mode_colors[vim.fn.mode()] or default_color }
        if bold then
          opts.gui = 'bold'
        end
        return opts
      end
    end

    local function get_mode_text()
      return mode_map[vim.fn.mode()] or 'UNKNOWN'
    end

    local conditions = {
      buffer_not_empty = function()
        return vim.fn.empty(vim.fn.expand '%:t') ~= 1
      end,
      hide_in_width = function()
        return vim.fn.winwidth(0) > 80
      end,
      check_git_workspace = function()
        local filepath = vim.fn.expand '%:p:h'
        local gitdir = vim.fn.finddir('.git', filepath .. ';')
        return gitdir and #gitdir > 0 and #gitdir < #filepath
      end,
    }

    local config = {
      options = {
        component_separators = '',
        section_separators = '',
        theme = {
          normal = { c = { fg = colors.fg, bg = colors.bg } },
          inactive = { c = { fg = colors.fg, bg = colors.bg } },
        },
      },
      sections = {
        lualine_a = {},
        lualine_b = {},
        lualine_y = {},
        lualine_z = {},
        lualine_c = {},
        lualine_x = {},
      },
      inactive_sections = {
        lualine_a = {},
        lualine_b = {},
        lualine_y = {},
        lualine_z = {},
        lualine_c = {},
        lualine_x = {},
      },
    }

    local function ins_left(component)
      table.insert(config.sections.lualine_c, component)
    end

    local function ins_right(component)
      table.insert(config.sections.lualine_x, component)
    end

    ins_left {
      function()
        return '▊'
      end,
      color = get_mode_color(colors.blue),
      padding = { left = 0, right = 1 },
    }

    ins_left {
      get_mode_text,
      color = get_mode_color(colors.fg, true),
      padding = { right = 1 },
    }

    ins_left {
      'filesize',
      cond = conditions.buffer_not_empty,
    }

    ins_left {
      'filename',
      cond = conditions.buffer_not_empty,
      color = { fg = colors.magenta, gui = 'bold' },
    }

    ins_left { 'location' }

    ins_left { 'progress', color = { fg = colors.fg, gui = 'bold' } }

    ins_left {
      'diagnostics',
      sources = { 'nvim_diagnostic' },
      symbols = { error = ' ', warn = ' ', info = ' ' },
      diagnostics_color = {
        error = { fg = colors.red },
        warn = { fg = colors.yellow },
        info = { fg = colors.cyan },
      },
    }

    ins_left {
      function()
        return '%='
      end,
    }

    ins_left {
      function()
        local msg = 'No Active Lsp'
        local buf_ft = vim.api.nvim_get_option_value('filetype', { buf = 0 })
        local clients = vim.lsp.get_clients()
        if next(clients) == nil then
          return msg
        end
        for _, client in ipairs(clients) do
          ---@diagnostic disable-next-line: undefined-field
          local filetypes = client.config.filetypes
          if filetypes and vim.fn.index(filetypes, buf_ft) ~= -1 then
            return client.name
          end
        end
        return msg
      end,
      icon = ' LSP:',
      color = { fg = colors.cyan, gui = 'bold' },
    }

    ins_right {
      'o:encoding',
      fmt = string.upper,
      cond = conditions.hide_in_width,
      color = { fg = colors.green, gui = 'bold' },
    }

    ins_right {
      'fileformat',
      fmt = string.upper,
      icons_enabled = false,
      color = { fg = colors.green, gui = 'bold' },
    }

    ins_right {
      'filetype',
      color = { fg = colors.cyan },
    }

    ins_right {
      'branch',
      icon = '',
      color = { fg = colors.violet, gui = 'bold' },
    }

    ins_right {
      'diff',
      symbols = { added = ' ', modified = '󰝤 ', removed = ' ' },
      diff_color = {
        added = { fg = colors.green },
        modified = { fg = colors.orange },
        removed = { fg = colors.red },
      },
      cond = conditions.hide_in_width,
    }

    ins_right {
      function()
        return require('opencode').statusline()
      end,
      color = function()
        local status = require('opencode.status').status
        if status == 'idle' then
          return { fg = colors.green }
        elseif status == 'responding' then
          return { fg = colors.blue }
        elseif status == 'requesting_permission' then
          return { fg = colors.yellow }
        elseif status == 'error' then
          return { fg = colors.red }
        else
          return { fg = colors.fg }
        end
      end,
      padding = { left = 1, right = 1 },
    }

    ins_right {
      function()
        return '▊'
      end,
      color = get_mode_color(colors.blue),
      padding = { left = 1 },
    }

    lualine.setup(config)
  end,
}
