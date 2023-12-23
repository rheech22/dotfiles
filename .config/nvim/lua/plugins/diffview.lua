return {
  {
    "sindrets/diffview.nvim",
    cmd = { "DiffviewOpen", "DiffviewClose", "DiffviewToggleFiles", "DiffviewFocusFiles" },
    keys = {
      { "<leader>go", "<cmd>DiffviewOpen<cr>", desc = "git diff view open" },
      { "<leader>gc", "<cmd>DiffviewClose<cr>", desc = "git diff view close" },
    },
  },
}
