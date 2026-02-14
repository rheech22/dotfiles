return {
  config = function()
    require('blink.cmp').setup {
      -- NOTE: you need to run "cargo build --release" in the blink plugin directory
      fuzzy = { implementation = 'prefer_rust_with_warning' },

      snippets = {
        preset = 'mini_snippets',
      },

      sources = {
        default = { 'snippets', 'lsp', 'path', 'buffer' },
      },

      completion = {
        list = {
          selection = {
            preselect = true,
            auto_insert = true,
          },
        },
        accept = {
          auto_brackets = {
            enabled = true,
          },
        },
        documentation = {
          auto_show = true,
          auto_show_delay_ms = 100,
        },
        ghost_text = {
          enabled = vim.g.ai_cmp,
        },
      },

      keymap = {
        preset = 'super-tab',
      },

      per_filetype = {
        vimwiki = { 'snippets', 'path', 'buffer' },
      },
    }
  end,
}
