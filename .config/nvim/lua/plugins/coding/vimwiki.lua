return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = {
      config = function()
        -- register vimwiki for highlighting in vimwiki
        vim.treesitter.language.register('markdown', 'vimwiki')
      end,
    },
  },
  {
    'vimwiki/vimwiki',
    branch = 'dev',
    init = function()
      vim.g.vimwiki_list = {
        {
          path = '~/Library/Mobile Documents/com~apple~CloudDocs/Notes',
          ext = '.md',
          diary_rel_path = 'retrospectives',
        },
      }
      vim.g.vimwiki_ext2syntax = {
        ['.md'] = 'markdown',
        ['.markdown'] = 'markdown',
        ['.mdx'] = 'markdown',
      }

      -- vimwiki에서 frontmatter를 관리하는 autocmds 추가
      local group =
        vim.api.nvim_create_augroup('VimwikiFrontmatter', { clear = true })

      -- 새 위키 파일을 만들 때 frontmatter 추가
      vim.api.nvim_create_autocmd('BufNewFile', {
        group = group,
        pattern = {
          '*/fleeting-notes/*.md',
          '*/reference-notes/*.md',
          '*/blog/*.md',
        },
        callback = function()
          -- -- vimwiki 파일인지 확인
          -- local path = vim.fn.expand '%:p'
          -- local wiki_path = vim.g.vimwiki_list[1].path
          -- if not string.match(path, wiki_path) then
          --   return
          -- end

          if vim.fn.line '$' > 1 then
            return
          end

          local template = {
            '---',
            'created: ' .. os.date '%Y-%m-%d %H:%M:%S +0900',
            'updated: ' .. os.date '%Y-%m-%d %H:%M:%S +0900',
            'tags: []',
            '---',
            '',
          }

          vim.api.nvim_buf_set_lines(0, 0, 0, false, template)

          vim.fn.execute 'normal! G'
          vim.fn.execute 'normal! $'

          print 'frontmatter added.'
        end,
      })

      -- 파일 저장 시 frontmatter의 updated 필드 갱신
      vim.api.nvim_create_autocmd('BufWritePre', {
        group = group,
        pattern = {
          '*/fleeting-notes/*.md',
          '*/reference-notes/*.md',
          '*/blog/*.md',
        },
        callback = function()
          -- vimwiki 파일인지 확인
          -- local path = vim.fn.expand '%:p'
          -- local wiki_path = vim.g.vimwiki_list[1].path
          -- if not string.match(path, wiki_path) then
          --   return
          -- end

          if vim.g.md_modify_disabled then
            return
          end
          if not vim.bo.modified then
            return
          end

          local save_cursor = vim.fn.getpos '.'
          local n = math.min(10, vim.fn.line '$')

          for i = 1, n do
            local line = vim.fn.getline(i)
            if line:match '^updated: ' then
              vim.fn.setline(
                i,
                'updated: ' .. os.date '%Y-%m-%d %H:%M:%S +0900'
              )
              vim.fn.setpos('.', save_cursor)
              return
            end
          end
        end,
      })
    end,
    keys = function()
      return {
        { '\\ww', '<Plug>VimwikiIndex', desc = 'Go to WikiIndex' },
        { '\\wi', '<Plug>VimwikiDiaryIndex', desc = 'Go to DiaryIndex' },
        {
          '\\w\\w',
          '<Plug>VimwikiMakeDiaryNote',
          desc = 'Create a Dairy Note',
        },
        {
          '\\w\\g',
          '<Plug>VimwikiDiaryGenerateLinks',
          desc = 'Generate Links for Diary Notes',
        },
        { '\\]', '<Plug>VimwikiToggleListItem' },
      }
    end,
  },
}
