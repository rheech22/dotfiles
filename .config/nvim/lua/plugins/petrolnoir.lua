return {
  config = function()
    require('petrolnoir').setup {}

    vim.cmd 'colorscheme petrolnoir'
  end,
}
