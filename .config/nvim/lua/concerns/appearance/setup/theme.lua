local M = {
  available_themes = {
    'vague',
    'seoul256-light',
  },
}

local theme_file = vim.fn.expand '~/.local/state/dotfiles/theme.txt'
local palettes = require 'utils.theme-colors'
local supported_themes = {}

for _, theme in ipairs(M.available_themes) do
  supported_themes[theme] = true
end

local function normalize_theme(name)
  if name and supported_themes[name] then
    return name
  end
  return 'vague'
end

local function get_palette(name)
  return palettes[name] or palettes.vague
end

local function read_theme_state()
  local f = io.open(theme_file, 'r')
  if not f then
    return nil
  end

  local name = f:read('*all'):gsub('%s+', '')
  f:close()
  return name
end

local function apply_winsep_highlight(p)
  vim.api.nvim_set_hl(0, 'ColorfulWinSep', { fg = p.winsep_fg, bg = p.bg })
end

local function apply_gutter_highlights(p)
  local groups = { 'LineNr', 'LineNrAbove', 'LineNrBelow', 'SignColumn' }
  for _, group in ipairs(groups) do
    vim.api.nvim_set_hl(0, group, { bg = p.bg })
  end
end

local function apply_render_md_highlights(p)
  local hls = {
    RenderMarkdownH1 = { fg = p.red, bold = true },
    RenderMarkdownH2 = { fg = p.blue, bold = true },
    RenderMarkdownH3 = { fg = p.yellow, bold = true },
    RenderMarkdownH4 = { fg = p.green, bold = true },
    RenderMarkdownH5 = { fg = p.purple, bold = true },
    RenderMarkdownH6 = { fg = p.teal, bold = true },
    RenderMarkdownH1Bg = { bg = p.h1_bg },
    RenderMarkdownH2Bg = { bg = p.h2_bg },
    RenderMarkdownH3Bg = { bg = p.h3_bg },
    RenderMarkdownH4Bg = { bg = p.h4_bg },
    RenderMarkdownH5Bg = { bg = p.h5_bg },
    RenderMarkdownH6Bg = { bg = p.h6_bg },
    RenderMarkdownCode = { bg = p.bg_dim },
    RenderMarkdownCodeBorder = { fg = p.surface },
    RenderMarkdownCodeInline = { bg = p.bg_line },
    RenderMarkdownBullet = { fg = p.lavender },
    RenderMarkdownChecked = { fg = p.green },
    RenderMarkdownUnchecked = { fg = p.comment },
    RenderMarkdownTodo = { fg = p.yellow },
  }
  for group, opts in pairs(hls) do
    vim.api.nvim_set_hl(0, group, opts)
  end
end

local function set_wezterm_theme(scheme)
  local b64 = vim.base64.encode(scheme)
  io.stdout:write(('\027]1337;SetUserVar=%s=%s\007'):format('nvim_theme', b64))
  io.stdout:flush()
end

---@param opts { broadcast?: boolean }|nil
function M.apply_theme(name, opts)
  name = normalize_theme(name)
  opts = opts or {}

  if name == 'seoul256-light' then
    vim.o.background = 'light'
    vim.cmd.colorscheme 'seoul256-light'
  elseif name == 'vague' then
    vim.o.background = 'dark'
    require('vague').setup {}
    vim.cmd.colorscheme 'vague'
  end

  local p = get_palette(name)
  apply_winsep_highlight(p)
  apply_gutter_highlights(p)
  apply_render_md_highlights(p)

  vim.g.applied_colorscheme = name

  if opts.broadcast ~= false and vim.g.last_synced_scheme ~= name then
    set_wezterm_theme(name)
    vim.g.last_synced_scheme = name
  end
end

function M.sync()
  local name = read_theme_state()
  if name then
    M.apply_theme(name, { broadcast = false })
  else
    M.apply_theme('vague', { broadcast = false })
  end
end

function M.config()
  M.sync()

  vim.api.nvim_create_autocmd('Signal', {
    pattern = 'SIGUSR1',
    callback = function()
      local name = read_theme_state()
      if name then
        M.apply_theme(name, { broadcast = false })
        vim.g.last_synced_scheme = name
      end
    end,
  })

  vim.api.nvim_create_autocmd('FocusGained', {
    callback = function()
      local name = read_theme_state()
      if name and name ~= vim.g.applied_colorscheme then
        M.apply_theme(name, { broadcast = false })
        vim.g.last_synced_scheme = name
      end
    end,
  })
end

return M
