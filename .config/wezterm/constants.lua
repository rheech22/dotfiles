local M = {}

local wezterm = require("wezterm")

M.bg_blurred_darker = wezterm.config_dir .. "/assets/bg-blurred-darker.png"
M.bg_blurred = wezterm.config_dir .. "/assets/bg-blurred.png"
M.bg_gradient = wezterm.config_dir .. "/assets/bg-gradient.jpg"
M.bg_image = M.bg_blurred

return M
