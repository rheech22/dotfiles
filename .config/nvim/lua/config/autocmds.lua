-- Autocmds are automatically loaded on the VeryLazy event

-- vim.api.nvim_create_autocmd('InsertLeave', {
--   pattern = '*',
--   command = 'set nopaste',
-- })

vim.api.nvim_create_autocmd('FileType', {
  pattern = { 'json', 'jsonc', 'md', 'markdown' },
  callback = function()
    vim.opt.spell = false
    vim.opt.conceallevel = 0
  end,
})

vim.api.nvim_create_autocmd({ 'BufNewFile' }, {
  pattern = { '*/wikis/*.md', '*/gdrive/*.md' },
  callback = function()
    if vim.fn.line '$' > 1 then
      return
    end

    local template = {
      '---',
      'created: ' .. os.date '%Y-%m-%d %H:%M:%S +0900',
      'updated: ' .. os.date '%Y-%m-%d %H:%M:%S +0900',
      '---',
      '',
    }

    vim.api.nvim_buf_set_lines(0, 0, 0, false, template)

    vim.fn.execute 'normal! G'
    vim.fn.execute 'normal! $'

    print 'new wiki has been created'
  end,
})

vim.api.nvim_create_autocmd({ 'BufWritePre' }, {
  pattern = { '*/wikis/*.md', '*/gdrive/*.md' },
  callback = function()
    if vim.g.md_modify_disabled then
      return
    end

    if vim.bo.modified then
      local save_cursor = vim.fn.getpos '.'
      local n = math.min(10, vim.fn.line '$')

      for i = 1, n do
        local line = vim.fn.getline(i)
        if line:match '^updated:' then
          local updated = line:gsub(
            '^updated:.*',
            'updated: ' .. os.date '%Y-%m-%d %H:%M:%S +0900'
          )
          vim.api.nvim_buf_set_lines(0, i - 1, i, false, { updated })
          print 'updated just updated !'
          break
        end
      end

      vim.fn.setpos('.', save_cursor)
    end
  end,
})
