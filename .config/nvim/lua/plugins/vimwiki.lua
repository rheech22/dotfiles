return {
  {
    "vimwiki/vimwiki",
    branch = "dev",
    init = function()
      vim.g.vimwiki_list = {
        { path = "~/Projects/rheech22.github.io/src/wikis", ext = ".md" },
        { path = "~/Documents/gdrive", ext = ".md" },
      }
      vim.g.vimwiki_ext2syntax = { [".md"] = "markdown", [".markdown"] = "markdown" }
    end,
    keys = function()
      return {
        { "\\ww", "<Plug>VimwikiIndex", desc = "Go to WikiIndex" },
      }
    end,
  },
}
