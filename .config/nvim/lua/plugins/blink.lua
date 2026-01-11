return {
  config = function()
    require('blink.cmp').setup {
      enabled = function()
        return not vim.tbl_contains({ 'vimwiki' }, vim.bo.filetype)
      end,
      -- NOTE: you need to run "cargo build --release" in the blink plugin directory
      fuzzy = { implementation = 'prefer_rust_with_warning' },

      snippets = {
        preset = 'mini_snippets',
      },

      sources = {
        default = { 'lsp', 'path', 'snippets', 'buffer' },
      },

      completion = {
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
        preset = 'enter',
      },
    }
  end,
}
