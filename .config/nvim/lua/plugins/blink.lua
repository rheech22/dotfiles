return {
  config = function()
    require('blink.cmp').setup {
      -- NOTE: you need to run "cargo build --release" in the blink plugin directory
      fuzzy = { implementation = 'prefer_rust_with_warning' },

      snippets = {
        preset = 'default',
      },

      sources = {
        default = { 'lsp', 'path', 'snippets', 'buffer', 'copilot' },
        providers = {
          copilot = {
            name = 'copilot',
            module = 'blink-copilot',
            async = true,
          },
        },
      },

      keymap = {
        preset = 'super-tab',
      },

      completion = {
        documentation = { auto_show = true, auto_show_delay_ms = 500 },

        ghost_text = { enabled = true },
      },
    }
  end,
}
