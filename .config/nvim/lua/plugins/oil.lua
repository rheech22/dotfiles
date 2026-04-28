return {
  config = function()
    require('oil').setup {
      lsp_file_methods = {
        enabled = true,
        timeout_ms = 1000,
        autosave_changes = true,
      },
      view_options = {
        show_hidden = true,
      },
      columns = {
        'permissions',
        'icon',
      },
      float = {
        max_width = 0.7,
        max_height = 0.6,
        border = 'rounded',
      },
    }

    vim.api.nvim_create_autocmd('User', {
      group = vim.api.nvim_create_augroup('OilSnacksRename', { clear = true }),
      pattern = 'OilActionsPost',
      callback = function(event)
        for _, action in ipairs(event.data.actions or {}) do
          if action.type == 'move' then
            require('snacks').rename.on_rename_file(action.src_url, action.dest_url)
          end
        end
      end,
    })
  end,
}
