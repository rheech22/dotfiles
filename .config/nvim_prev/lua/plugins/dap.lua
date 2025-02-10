return {
  "rcarriga/nvim-dap-ui",
  opts = {
    floating = { border = "rounded" },
    expand_lines = true,
    layouts = {
      {
        elements = {
          {
            id = "breakpoints",
            size = 0.5,
          },
          {
            id = "watches",
            size = 0.5,
          },
        },
        position = "left",
        size = 50,
      },
      {
        elements = { {
          id = "repl",
          size = 1.0,
        } },
        position = "bottom",
        size = 20,
      },
    },
  },
}
