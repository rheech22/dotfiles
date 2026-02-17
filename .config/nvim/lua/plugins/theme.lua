local M = {
  available_themes = {
    'vague',
    'everforest',
    'teide-darker',
    'catppuccin-latte',
    'catppuccin-frappe',
    'catppuccin-macchiato',
    'catppuccin-mocha',
  },
}

local theme_file = vim.fn.expand '~/.cache/theme.txt'
local palettes = require 'utils.theme-colors'

local function get_palette(name)
  return palettes[name] or palettes.vague
end

local function apply_winsep_highlight(p)
  vim.api.nvim_set_hl(0, 'ColorfulWinSep', { fg = p.winsep_fg, bg = p.bg })
end

local function apply_render_md_highlights(p)
  local hls = {
    RenderMarkdownH1         = { fg = p.red, bold = true },
    RenderMarkdownH2         = { fg = p.blue, bold = true },
    RenderMarkdownH3         = { fg = p.yellow, bold = true },
    RenderMarkdownH4         = { fg = p.green, bold = true },
    RenderMarkdownH5         = { fg = p.purple, bold = true },
    RenderMarkdownH6         = { fg = p.teal, bold = true },
    RenderMarkdownH1Bg       = { bg = p.h1_bg },
    RenderMarkdownH2Bg       = { bg = p.h2_bg },
    RenderMarkdownH3Bg       = { bg = p.h3_bg },
    RenderMarkdownH4Bg       = { bg = p.h4_bg },
    RenderMarkdownH5Bg       = { bg = p.h5_bg },
    RenderMarkdownH6Bg       = { bg = p.h6_bg },
    RenderMarkdownCode       = { bg = p.bg_dim },
    RenderMarkdownCodeBorder = { fg = p.surface },
    RenderMarkdownCodeInline = { bg = p.bg_line },
    RenderMarkdownBullet     = { fg = p.lavender },
    RenderMarkdownChecked    = { fg = p.green },
    RenderMarkdownUnchecked  = { fg = p.comment },
    RenderMarkdownTodo       = { fg = p.yellow },
  }
  for group, opts in pairs(hls) do
    vim.api.nvim_set_hl(0, group, opts)
  end
end

local function set_wezterm_theme(scheme)
  local b64 = vim.base64.encode(scheme)
  -- Use io.stdout:write and flush to ensure the OSC sequence reaches Wezterm immediately
  io.stdout:write(('\027]1337;SetUserVar=%s=%s\007'):format('nvim_theme', b64))
  io.stdout:flush()
end

function M.apply_theme(name)
  if not name or name == '' then
    name = 'vague'
  end

  -- Theme specific configuration
  if name:match '^catppuccin' then
    local flavor = name:match 'latte' and 'latte'
      or name:match 'frappe' and 'frappe'
      or name:match 'macchiato' and 'macchiato'
      or 'mocha'
    vim.o.background = (flavor == 'latte') and 'light' or 'dark'
    require('catppuccin').setup { flavour = flavor }
    vim.cmd.colorscheme 'catppuccin'
  elseif name == 'everforest' then
    vim.g.everforest_background = 'medium'
    vim.o.background = 'light'
    vim.cmd.colorscheme 'everforest'
  elseif name == 'teide-darker' then
    vim.o.background = 'dark'
    vim.cmd.colorscheme 'teide-darker'
  elseif name == 'vague' then
    vim.o.background = 'dark'
    require('vague').setup {}
    vim.cmd.colorscheme 'vague'
  else
    vim.o.background = 'dark'
    pcall(vim.cmd.colorscheme, name)
  end

  local p = get_palette(name)
  apply_winsep_highlight(p)
  apply_render_md_highlights(p)

  vim.g.applied_colorscheme = name

  -- Sync with Wezterm only if it's a new change (to avoid infinite loops)
  if vim.g.last_synced_scheme ~= name then
    set_wezterm_theme(name)
    vim.g.last_synced_scheme = name

    -- Save state for next startup
    local f = io.open(theme_file, 'w')
    if f then
      f:write(name)
      f:close()
    end
  end
end

function M.sync()
  local f = io.open(theme_file, 'r')
  if f then
    local name = f:read('*all'):gsub('%s+', '')
    f:close()
    M.apply_theme(name)
  else
    M.apply_theme 'vague'
  end
end

function M.config()
  M.sync()

  -- Listen for signals from Wezterm
  vim.api.nvim_create_autocmd('Signal', {
    pattern = 'SIGUSR1',
    callback = function()
      -- Force reload from file
      local f = io.open(theme_file, 'r')
      if f then
        local name = f:read('*all'):gsub('%s+', '')
        f:close()
        -- Mark as synced to Wezterm before applying to avoid sending signal back
        vim.g.last_synced_scheme = name
        M.apply_theme(name)
      end
    end,
  })

  -- Backup: Sync on focus
  vim.api.nvim_create_autocmd('FocusGained', {
    callback = function()
      local f = io.open(theme_file, 'r')
      if f then
        local name = f:read('*all'):gsub('%s+', '')
        f:close()
        if name ~= vim.g.applied_colorscheme then
          vim.g.last_synced_scheme = name
          M.apply_theme(name)
        end
      end
    end,
  })
end

return M
