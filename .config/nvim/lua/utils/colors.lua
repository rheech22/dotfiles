local M = {}

local function _hex_to_rgb(hex)
  return {
    r = tonumber(hex:sub(2, 3), 16),
    g = tonumber(hex:sub(4, 5), 16),
    b = tonumber(hex:sub(6, 7), 16),
  }
end

local function _rgb_to_hex(rgb)
  return string.format('#%02x%02x%02x', rgb.r, rgb.g, rgb.b)
end

function M.get_bg()
  local hl = vim.api.nvim_get_hl(0, { name = 'Normal', link = false })
  return hl.bg and string.format('#%06x', hl.bg) or '#000000'
end

function M.blend(fg, bg, alpha)
  local f = _hex_to_rgb(fg)
  local b = _hex_to_rgb(bg)

  return _rgb_to_hex {
    r = math.floor((1 - alpha) * f.r + alpha * b.r),
    g = math.floor((1 - alpha) * f.g + alpha * b.g),
    b = math.floor((1 - alpha) * f.b + alpha * b.b),
  }
end

return M
