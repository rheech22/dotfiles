return {
  config = function()
    require('fidget').setup {
      notification = {
        window = {
          normal_hl = 'DiagnosticOk',
          border_hl = 'DiagnosticWarn',
          border = 'rounded',
          align = 'top',
        },
      },
    }
  end,
}
