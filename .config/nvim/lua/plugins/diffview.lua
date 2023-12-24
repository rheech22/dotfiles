return {
  {
    "sindrets/diffview.nvim",
    keys = {
      { "<leader>do", "<cmd>DiffviewOpen<cr>", desc = "DiffView Open" },
      { "<leader>dc", "<cmd>DiffviewClose<cr>", desc = "DiffView Close" },
    },
    config = {
      view = {
        merge_tool = {
          layout = "diff3_mixed",
        },
      },
    },
  },
}
