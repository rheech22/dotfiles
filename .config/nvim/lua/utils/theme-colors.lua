-- Theme color palettes
-- Shared constants consumed by theme.lua (and potentially other plugins)
-- Each palette uses a unified key structure so highlight builders can be theme-agnostic.
--
-- Key reference:
--   bg, bg_dim, bg_line    – background shades (normal, code block, inline code)
--   fg, comment            – foreground / muted text
--   red, blue, yellow,
--   green, purple, teal    – six accents (heading H1–H6 in this order)
--   lavender               – secondary accent (bullets, etc.)
--   surface                – subtle border / separator (code block border, etc.)
--   winsep_fg              – window separator foreground (may differ from accents)
--   h1_bg .. h6_bg         – tinted heading backgrounds

return {
  vague = {
    bg         = '#141415',
    bg_dim     = '#1c1c24',
    bg_line    = '#252530',
    fg         = '#cdcdcd',
    comment    = '#606079',
    surface    = '#606079',
    red        = '#d8647e',
    blue       = '#6e94b2',
    yellow     = '#f3be7c',
    green      = '#7fa563',
    purple     = '#bb9dbd',
    teal       = '#b4d4cf',
    lavender   = '#aeaed1',
    winsep_fg  = '#aeaed1',
    notify_err   = '#d8647e',
    notify_warn  = '#f3be7c',
    notify_info  = '#6e94b2',
    notify_debug = '#606079',
    notify_trace = '#aeaed1',
    h1_bg      = '#2a1e26',
    h2_bg      = '#1c2430',
    h3_bg      = '#2a2518',
    h4_bg      = '#1c2618',
    h5_bg      = '#251e28',
    h6_bg      = '#1c2826',
  },

  ['seoul256-light'] = {
    bg         = '#E1E1E1',
    bg_dim     = '#D9D9D9',
    bg_line    = '#D1D1D1',
    fg         = '#616161',
    comment    = '#757575',
    surface    = '#A8A8A8',
    red        = '#BF2172',
    blue       = '#0099BD',
    yellow     = '#9A7200',
    green      = '#719872',
    purple     = '#9A7599',
    teal       = '#97DDDF',
    lavender   = '#98BCBD',
    winsep_fg  = '#0099BD',
    notify_err   = '#BF2172',
    notify_warn  = '#9A7200',
    notify_info  = '#0099BD',
    notify_debug = '#757575',
    notify_trace = '#98BCBD',
    h1_bg      = '#F1DFE8',
    h2_bg      = '#DDECF0',
    h3_bg      = '#F2E7D0',
    h4_bg      = '#E7F0DD',
    h5_bg      = '#EADFEA',
    h6_bg      = '#DDEFF0',
  },
}
