return {
  -- { "nvim-treesitter/playground", cmd = "TSPlaygroundToggle" },

  {
    "nvim-treesitter/nvim-treesitter",
    opts = {
      ensure_installed = {
        "css",
        "gitignore",
        "go",
        "graphql",
        "http",
        "scss",
        "sql",
        "svelte",
        "markdown",
        "markdown_inline",
        "dart",
      },

      -- https://github.com/nvim-treesitter/playground#query-linter
      query_linter = {
        enable = true,
        use_virtual_text = true,
        lint_events = { "BufWrite", "CursorHold" },
      },

      playground = {
        enable = true,
        disable = {},
        updatetime = 25, -- Debounced time for highlighting nodes in the playground from source code
        persist_queries = true, -- Whether the query persists across vim sessions
        keybindings = {
          toggle_query_editor = "o",
          toggle_hl_groups = "i",
          toggle_injected_languages = "t",
          toggle_anonymous_nodes = "a",
          toggle_language_display = "I",
          focus_language = "f",
          unfocus_language = "F",
          update = "R",
          goto_node = "<cr>",
          show_help = "?",
        },
      },
    },
    config = function(_, opts)
      require("nvim-treesitter.configs").setup(opts)

      -- to show the backticks for code blocks in markdown
      require("vim.treesitter.query").set(
        "markdown",
        "highlights",
        [[
;From MDeiml/tree-sitter-markdown
[
  (fenced_code_block_delimiter)
] @punctuation.delimiter
]]
      )

      -- vim.filetype.add({ extension = { mdx = "mdx" } })

      -- vim.treesitter.language.register("markdown", "mdx")
      vim.treesitter.language.register("markdown", "vimwiki") -- register vimwiki for highlighting in vimwiki
    end,
  },
}
