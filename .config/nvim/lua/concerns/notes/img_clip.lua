local M = {}

local image_extensions = {
  png = true,
  jpg = true,
  jpeg = true,
  gif = true,
  webp = true,
  bmp = true,
  svg = true,
}

local function get_file_path_from_clipboard()
  local script = [[osascript << 'EOF'
use framework "AppKit"
set urls to current application's NSPasteboard's generalPasteboard()'s readObjectsForClasses:{current application's NSURL} options:(missing value)
if urls is not missing value and (count of urls) > 0 then return ((item 1 of urls)'s |path|()) as text
EOF]]

  local handle = io.popen(script)
  if not handle then
    return nil
  end

  local result = handle:read('*a'):gsub('%s+$', '')
  handle:close()

  return result ~= '' and result or nil
end

local function is_image(path)
  local ext = path:match '%.([^.]+)$'
  return ext and image_extensions[ext:lower()] or false
end

function M.paste_image()
  local img_clip = require 'img-clip'
  local file_path = get_file_path_from_clipboard()

  if file_path and is_image(file_path) and io.open(file_path, 'r') then
    img_clip.paste_image({}, file_path)
  elseif require('img-clip.clipboard').content_is_image() then
    img_clip.paste_image()
  else
    vim.notify('No image in clipboard', vim.log.levels.WARN)
  end
end

return M
