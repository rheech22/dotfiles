return {
  config = function()
    vim.g.vimwiki_list = {
      {
        path = vim.fn.expand '~/Library/Mobile Documents/com~apple~CloudDocs/Notes',
        ext = '.md',
        diary_rel_path = 'retrospectives',
      },
    }
    vim.g.vimwiki_ext2syntax = {
      ['.md'] = 'markdown',
      ['.mdx'] = 'markdown',
    }

    -- autocmds
    local group = vim.api.nvim_create_augroup('VimwikiFrontmatter', { clear = true })
    vim.api.nvim_create_autocmd('BufNewFile', {
      group = group,
      pattern = {
        '*/note/*.md',
        '*/blog/*.md',
      },
      callback = function()
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

    vim.api.nvim_create_autocmd('BufWritePre', {
      group = group,
      pattern = {
        '*/note/*.md',
        '*/blog/*.md',
      },
      callback = function()
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
            vim.fn.setline(i, 'updated: ' .. os.date '%Y-%m-%d %H:%M:%S +0900')
            vim.fn.setpos('.', save_cursor)
            return
          end
        end
      end,
    })
  end,
}
