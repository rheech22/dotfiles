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

local winsep_highlights = {
  vague = { fg = '#00FF00', bg = '#141415' },
  ['catppuccin-latte'] = { fg = '#1e66f5', bg = '#eff1f5' },
  ['catppuccin-frappe'] = { fg = '#8caaee', bg = '#303446' },
  ['catppuccin-macchiato'] = { fg = '#8aadf4', bg = '#24273a' },
  ['catppuccin-mocha'] = { fg = '#89b4fa', bg = '#1e1e2e' },
  ['teide-darker'] = { fg = '#5CCEFF', bg = '#171B20' },
  everforest = { fg = '#8da101', bg = '#FDF6E3' },
}

local function apply_winsep_highlight(name)
  local hl = winsep_highlights[name] or winsep_highlights.vague
  vim.api.nvim_set_hl(0, 'ColorfulWinSep', hl)
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

  apply_winsep_highlight(name)

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
