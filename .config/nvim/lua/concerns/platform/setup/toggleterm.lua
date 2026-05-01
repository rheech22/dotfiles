return {
  config = function()
    require('toggleterm').setup {
      direction = 'float',
      size = function(term)
        if term.direction == 'horizontal' then
          return math.floor(vim.o.lines * 0.3)
        elseif term.direction == 'vertical' then
          return math.floor(vim.o.columns * 0.4)
        end
      end,
      float_opts = {
        border = 'rounded',
        winblend = 0,
        title_pos = 'right',
        width = function()
          return math.floor(vim.o.columns * 0.8)
        end,
        height = function()
          return math.floor(vim.o.lines * 0.8)
        end,
      },
      shade_terminals = false,
      autochdir = true,
      persist_size = true,
      hide_numbers = true,
      auto_scroll = true,
      start_in_insert = true,
      close_on_exit = true,
    }
  end,
}
