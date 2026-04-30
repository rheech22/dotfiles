local snacks = require 'snacks'

local M = {}

function M.wiki_notes()
  local wiki_path = vim.fn.expand(vim.g.vimwiki_list[1].path)
  local index = wiki_path .. '/note/index.md'
  local lines = vim.fn.readfile(index)
  local items = {}

  for _, line in ipairs(lines) do
    local file, title = line:match '%[%[(.-)|(.-)]%]'
    if file and title then
      items[#items + 1] = {
        text = title,
        file = wiki_path .. '/note/' .. file .. '.md',
      }
    end
  end

  snacks.picker.pick {
    title = 'Wiki Notes',
    items = items,
    format = 'text',
    preview = 'preview',
    confirm = function(picker, item)
      picker:close()
      if item and item.file then
        vim.cmd('edit ' .. vim.fn.fnameescape(item.file))
      end
    end,
  }
end

function M.grep_wiki_notes()
  local note_dir = vim.fn.expand(vim.g.vimwiki_list[1].path) .. '/note'
  snacks.picker.grep {
    title = 'Wiki Notes Grep',
    dirs = { note_dir },
    glob = '*.md',
  }
end

function M.paste_image()
  require('concerns.notes.img_clip').paste_image()
end

return M
