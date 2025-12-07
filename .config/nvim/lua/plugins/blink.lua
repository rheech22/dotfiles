return {
  config = function()
    require('blink.cmp').setup {
      snippets = {
        preset = 'default',
      },

      appearance = {
        use_nvim_cmp_as_default = false,
        nerd_font_variant = 'mono',
      },

      -- NOTE: you need to run "cargo build --release" in the blink plugin directory
      fuzzy = { implementation = 'prefer_rust_with_warning' },

      completion = {
        accept = {
          auto_brackets = {
            enabled = true,
          },
        },
        menu = {
          draw = {
            treesitter = { 'lsp' },
          },
        },
        documentation = {
          auto_show = true,
          auto_show_delay_ms = 200,
        },
        ghost_text = {
          enabled = vim.g.ai_cmp,
        },
      },

      sources = {
        default = { 'lsp', 'path', 'snippets', 'buffer' },
      },

      cmdline = {
        enabled = true,
        keymap = {
          preset = 'cmdline',
          ['<Right>'] = false,
          ['<Left>'] = false,
        },
        completion = {
          list = { selection = { preselect = false } },
          menu = {
            auto_show = function(ctx)
              return vim.fn.getcmdtype() == ':'
            end,
          },
          ghost_text = { enabled = true },
        },
      },

      keymap = {
        preset = 'enter',
        ['<C-y>'] = { 'select_and_accept' },
      },
    }
  end,
}
