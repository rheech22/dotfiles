return {
  config = function()
    require('colorful-winsep').setup {
      border = 'rounded',
      excluded_ft = { 'mason' },
      animate = {
        enabled = 'shift',
      },
    }
  end,
}
