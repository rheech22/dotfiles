return {
  config = function()
    local lualine = require 'lualine'
    local Colors = require 'utils.colors'

    -- Common components and conditions
    local conditions = {
      buffer_not_empty = function()
        return vim.fn.empty(vim.fn.expand '%:t') ~= 1
      end,
      hide_in_width = function()
        return vim.fn.winwidth(0) > 80
      end,
    }

    local function get_lsp_client()
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
    end

    local function get_opencode_status()
      return require('opencode').statusline()
    end

    -- Custom configuration for 'vague' (Evil lualine style)
    local function build_vague_config()
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

      local mode_colors = {
        n = colors.red,
        i = colors.green,
        v = colors.blue,
        V = colors.blue,
        ['\22'] = colors.blue,
        c = colors.magenta,
        R = colors.violet,
        t = colors.red,
      }

      local function mode_color()
        return { fg = mode_colors[vim.fn.mode()] or colors.fg, gui = 'bold' }
      end

      return {
        options = {
          component_separators = '',
          section_separators = '',
          theme = {
            normal = { c = { fg = colors.fg, bg = colors.bg } },
            inactive = { c = { fg = colors.fg, bg = colors.bg } },
          },
        },
        sections = {
          lualine_c = {
            {
              function()
                return '▊'
              end,
              color = mode_color,
              padding = { left = 0, right = 1 },
            },
            { 'mode', color = mode_color, padding = { right = 1 } },
            { 'filesize', cond = conditions.buffer_not_empty },
            { 'filename', cond = conditions.buffer_not_empty, color = { fg = colors.magenta, gui = 'bold' } },
            { 'location' },
            { 'progress', color = { fg = colors.fg, gui = 'bold' } },
            {
              'diagnostics',
              sources = { 'nvim_diagnostic' },
              symbols = { error = ' ', warn = ' ', info = ' ' },
              diagnostics_color = {
                error = { fg = colors.red },
                warn = { fg = colors.yellow },
                info = { fg = colors.cyan },
              },
            },
            {
              function()
                return '%='
              end,
            },
            { get_lsp_client, icon = ' LSP:', color = { fg = colors.cyan, gui = 'bold' } },
          },
          lualine_x = {
            {
              'o:encoding',
              fmt = string.upper,
              cond = conditions.hide_in_width,
              color = { fg = colors.green, gui = 'bold' },
            },
            { 'fileformat', fmt = string.upper, icons_enabled = false, color = { fg = colors.green, gui = 'bold' } },
            { 'filetype', color = { fg = colors.cyan } },
            { 'branch', icon = '', color = { fg = colors.violet, gui = 'bold' } },
            {
              'diff',
              symbols = { added = ' ', modified = '󰝤 ', removed = ' ' },
              diff_color = {
                added = { fg = colors.green },
                modified = { fg = colors.orange },
                removed = { fg = colors.red },
              },
              cond = conditions.hide_in_width,
            },
            {
              get_opencode_status,
              color = function()
                local status = require('opencode.status').status
                local map = {
                  idle = colors.green,
                  responding = colors.blue,
                  requesting_permission = colors.yellow,
                  error = colors.red,
                }
                return { fg = map[status] or colors.fg }
              end,
              padding = { left = 1, right = 1 },
            },
            {
              function()
                return '▊'
              end,
              color = mode_color,
              padding = { left = 1 },
            },
          },
        },
      }
    end

    -- Configuration for other themes (Auto style)
    local function build_auto_config(theme_name)
      return {
        options = { theme = theme_name, component_separators = '', section_separators = '' },
        sections = {
          lualine_a = { 'mode' },
          lualine_b = { 'branch', 'diff' },
          lualine_c = {
            { 'filename', cond = conditions.buffer_not_empty },
            { 'diagnostics', sources = { 'nvim_diagnostic' } },
            {
              function()
                return '%='
              end,
            },
            { get_lsp_client, icon = ' LSP:' },
          },
          lualine_x = { { 'filetype' }, { get_opencode_status, padding = { left = 1, right = 1 } } },
          lualine_y = { 'progress' },
          lualine_z = { 'location' },
        },
      }
    end

    local function apply()
      local scheme = vim.g.colors_name or ''
      local config
      if scheme == 'vague' then
        config = build_vague_config()
      elseif scheme:match '^catppuccin' then
        config = build_auto_config 'catppuccin'
      else
        config = build_auto_config 'auto'
      end
      lualine.setup(config)
    end

    apply()
    vim.api.nvim_create_autocmd('ColorScheme', {
      callback = function()
        vim.schedule(apply)
      end,
    })
  end,
}
