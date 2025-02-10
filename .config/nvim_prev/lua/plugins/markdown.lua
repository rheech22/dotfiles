return {
  {
    "vimwiki/vimwiki",
    branch = "dev",
    init = function()
      vim.g.vimwiki_list = {
        { path = "~/Projects/rheech22.github.io/src/wikis", ext = ".md" },
        { path = "~/Projects/conerstone/src/app/blog/markdown", ext = ".mdx" },
      }
      vim.g.vimwiki_ext2syntax = { [".md"] = "markdown", [".markdown"] = "markdown", [".mdx"] = "markdown" }
    end,
    keys = function()
      return {
        { "\\ww", "<Plug>VimwikiIndex", desc = "Go to WikiIndex" },
        { "\\]", "<Plug>VimwikiToggleListItem" },
      }
    end,
  },
  {
    "iamcco/markdown-preview.nvim",
    cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
    ft = { "markdown" },
    build = function()
      vim.fn["mkdp#util#install"]()
    end,
    config = function()
      vim.g.mkdp_markdown_css = "~/.config/nvim/markdown-style.css"
    end,
  },
}
