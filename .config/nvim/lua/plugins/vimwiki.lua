return {
  config = function()
    vim.g.vimwiki_list = {
      {
        path = '~/Dropbox/wiki',
        ext = '.md',
        diary_rel_path = 'diary',
      },
    }
    vim.g.vimwiki_ext2syntax = {
      ['.md'] = 'markdown',
      ['.mdx'] = 'markdown',
    }

    -- autocmds      local group =
    vim.api.nvim_create_autocmd('BufNewFile', {
      group = vim.api.nvim_create_augroup('diary-date', { clear = true }),
      pattern = {
        '*/diary/*.md',
      },
      callback = function()
        if vim.fn.line '$' > 1 then
          return
        end

        local template = {
          '# ' .. os.date '%Y-%m-%d',
        }

        vim.api.nvim_buf_set_lines(0, 0, 0, false, template)

        vim.fn.execute 'normal! G'
        vim.fn.execute 'normal! $'

        print 'title added.'
      end,
    })
  end,
}
