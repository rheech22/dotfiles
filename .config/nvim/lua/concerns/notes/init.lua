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

function M.wiki_index()
  vim.cmd.normal({ '<Plug>VimwikiIndex', bang = true })
end

function M.diary_index()
  vim.cmd.normal({ '<Plug>VimwikiDiaryIndex', bang = true })
end

function M.make_diary_note()
  vim.cmd.normal({ '<Plug>VimwikiMakeDiaryNote', bang = true })
end

function M.diary_generate_links()
  vim.cmd.normal({ '<Plug>VimwikiDiaryGenerateLinks', bang = true })
end

function M.toggle_list_item()
  vim.cmd.normal({ '<Plug>VimwikiToggleListItem', bang = true })
end

function M.paste_image()
  require('concerns.notes.img_clip').paste_image()
end

return M
