return {
  config = function()
    require('github-theme').setup {}
    vim.cmd 'colorscheme github_light'
  end,
}
