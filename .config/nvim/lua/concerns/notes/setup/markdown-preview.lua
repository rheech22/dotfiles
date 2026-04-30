return {
  config = function()
    vim.g.mkdp_markdown_css = vim.fn.expand '~/.config/nvim/md_preview.css'
  end,
}
