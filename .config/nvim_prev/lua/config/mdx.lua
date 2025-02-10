local M = {}

function M.setup()
  vim.filetype.add({ extension = { mdx = "mdx" } })

  vim.treesitter.language.register("markdown", "mdx")

  if vim.endswith(vim.api.nvim_buf_get_name(0), ".mdx") and vim.o.filetype ~= "mdx" then
    vim.o.filetype = "mdx"
  end
end

return M
