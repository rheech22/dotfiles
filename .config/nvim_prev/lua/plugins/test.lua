return {
  {
    "nvim-neotest/neotest",
    dependencies = {
      {
        "sidlatau/neotest-dart",
      },
    },
    opts = {
      adapters = {
        ["neotest-dart"] = {
          command = "flutter",
          use_lsp = true,
          custom_test_method_names = {},
        },
      },
    },
  },

  -- opts = function(_, opts)
  --   vim.list_extend(opts.adapters, {
  --     require("neotest-dart")({ command = "flutter" }),
  --   })
  -- end,
}
