return {
  config = function()
    require('noice').setup {
      cmdline = {
        enabled = true,
        view = 'cmdline_popup',
      },
      lsp = {
        override = {
          ['vim.lsp.util.convert_input_to_markdown_lines'] = true,
          ['vim.lsp.util.stylize_markdown'] = true,
        },
        hover = {
          enabled = true,
          silent = true,
        },
        signature = {
          enabled = true,
          auto_open = {
            enabled = false,
          },
        },
      },
      messages = {
        enabled = true,
        view = 'notify',
        view_error = 'notify',
        view_warn = 'notify',
        view_history = 'messages',
        view_search = false,
      },
      notify = {
        enabled = true,
        view = 'notify',
      },
      popupmenu = {
        enabled = false,
      },
      presets = {
        bottom_search = true,
        command_palette = true,
        long_message_to_split = true,
        inc_rename = false,
        lsp_doc_border = true,
      },
      routes = {
        {
          filter = {
            event = 'msg_show',
            kind = 'search_count',
          },
          view = 'mini',
        },
      },
    }
  end,
}
