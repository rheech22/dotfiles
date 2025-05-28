-- autopairs
-- https://github.com/windwp/nvim-autopairs

return {
  'windwp/nvim-autopairs',
  event = 'InsertEnter',
  dependencies = { 'hrsh7th/nvim-cmp' },
  config = function()
    require('nvim-autopairs').setup {}

    local cmp_autopairs = require 'nvim-autopairs.completion.cmp'
    local cmp = require 'cmp'

    local function custom_confirm_done(event)
      -- vim.api.nvim_err_writeln(
      --   'confirm_done event: ' .. vim.inspect(event.entry.context)
      -- )
      if event.entry.context.filetype == 'codecompanion' then
        return
      end
      cmp_autopairs.on_confirm_done()(event)
    end
    cmp.event:on('confirm_done', custom_confirm_done)
  end,
}
