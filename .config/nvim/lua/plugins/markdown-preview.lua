return {
  'iamcco/markdown-preview.nvim',
  cmd = { 'MarkdownPreviewToggle', 'MarkdownPreview', 'MarkdownPreviewStop' },
  build = 'cd app && yarn install',
  ft = { 'markdown' },
  config = function()
    vim.g.mkdp_markdown_css = vim.fn.expand '~/.config/nvim/md_preview.css'
  end,
}
