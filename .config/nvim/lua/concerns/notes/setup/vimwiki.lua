return {
  config = function()
    local wiki_dir = vim.fn.expand(os.getenv 'HOME_WIKI_PATH' or '~/temp-wiki')
    local note_patterns = {
      '*/zt/literature/*.md',
      '*/zt/fleeting/*.md',
      '*/zt/fleeting/mole/*.md',
      '*/zt/permanent/*.md',
      '*/blog/*.md',
    }

    vim.g.vimwiki_list = {
      {
        path = wiki_dir,
        ext = '.md',
        diary_rel_path = 'retrospectives',
      },
    }
    vim.g.vimwiki_ext2syntax = {
      ['.md'] = 'markdown',
      ['.mdx'] = 'markdown',
    }

    local group = vim.api.nvim_create_augroup('VimwikiFrontmatter', { clear = true })
    vim.api.nvim_create_autocmd('BufNewFile', {
      group = group,
      pattern = note_patterns,
      callback = function()
        if vim.fn.line '$' > 1 then
          return
        end

        local template = {
          '---',
          'created: ' .. os.date '%Y-%m-%d %H:%M:%S +0900',
          'updated: ' .. os.date '%Y-%m-%d %H:%M:%S +0900',
          'title: ',
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

    vim.api.nvim_create_autocmd('BufWritePre', {
      group = group,
      pattern = note_patterns,
      callback = function()
        if vim.g.md_modify_disabled or not vim.bo.modified then
          return
        end

        local save_cursor = vim.fn.getpos '.'
        local n = math.min(10, vim.fn.line '$')

        for i = 1, n do
          local line = vim.fn.getline(i)
          if line:match '^updated: ' then
            vim.fn.setline(i, 'updated: ' .. os.date '%Y-%m-%d %H:%M:%S +0900')
            vim.fn.setpos('.', save_cursor)
            return
          end
        end
      end,
    })

    vim.api.nvim_create_autocmd('BufNewFile', {
      group = vim.api.nvim_create_augroup('VimwikiDiaryDate', { clear = true }),
      pattern = { '*/' .. 'retrospectives' .. '/*.md' },
      callback = function()
        if vim.fn.line '$' > 1 then
          return
        end

        vim.api.nvim_buf_set_lines(0, 0, 0, false, {
          '# ' .. os.date '%Y-%m-%d',
        })
        vim.fn.execute 'normal! G'
        vim.fn.execute 'normal! $'
        print 'title added.'
      end,
    })
  end,
}
