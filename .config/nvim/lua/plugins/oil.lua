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
  end,
}
