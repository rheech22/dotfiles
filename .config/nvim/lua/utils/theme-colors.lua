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
    winsep_fg  = '#00FF00',
    h1_bg      = '#2a1e26',
    h2_bg      = '#1c2430',
    h3_bg      = '#2a2518',
    h4_bg      = '#1c2618',
    h5_bg      = '#251e28',
    h6_bg      = '#1c2826',
  },

  ['teide-darker'] = {
    bg         = '#171B20',
    bg_dim     = '#10141a',
    bg_line    = '#2C313A',
    fg         = '#E7EAEE',
    comment    = '#586172',
    surface    = '#474E5C',
    red        = '#F97791',
    blue       = '#5CCEFF',
    yellow     = '#FFE77A',
    green      = '#38FFA5',
    purple     = '#B1A2FF',
    teal       = '#41FFDC',
    lavender   = '#89BEFF',
    winsep_fg  = '#5CCEFF',
    h1_bg      = '#261820',
    h2_bg      = '#142028',
    h3_bg      = '#262218',
    h4_bg      = '#142618',
    h5_bg      = '#1e1828',
    h6_bg      = '#142426',
  },

  everforest = {
    bg         = '#FDF6E3',
    bg_dim     = '#EFEBD4',
    bg_line    = '#E6E2CC',
    fg         = '#5C6A72',
    comment    = '#A6B0A0',
    surface    = '#A6B0A0',
    red        = '#F85552',
    blue       = '#3A94C5',
    yellow     = '#DFA000',
    green      = '#8DA101',
    purple     = '#DF69BA',
    teal       = '#35A77C',
    lavender   = '#3A94C5',
    winsep_fg  = '#8DA101',
    h1_bg      = '#FDE3DA',
    h2_bg      = '#E9F0E9',
    h3_bg      = '#FAEDCD',
    h4_bg      = '#F0F1D2',
    h5_bg      = '#FAE8E2',
    h6_bg      = '#E1F0E8',
  },
}
