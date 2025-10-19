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

    -- autocmd:codecompanion spinner
    -- https://github.com/olimorris/codecompanion.nvim/discussions/813#discussioncomment-12289384
    local progress = require 'fidget.progress'
    local handles = {}
    local function _get_role_name(adapter)
      local parts = {}
      table.insert(parts, adapter.formatted_name)
      if adapter.model and adapter.model ~= '' then
        table.insert(parts, '(' .. adapter.model .. ')')
      end
      return table.concat(parts, ' ')
    end
    local function _register_handle(id, handle)
      handles[id] = handle
    end
    local function _pop_handle(id)
      local handle = handles[id]
      handles[id] = nil
      return handle
    end
    local function _create_handle(request)
      local title = ' Requesting assistance'
      if request.data.strategy then
        title = title .. ' (' .. request.data.strategy .. ')'
      end
      return progress.handle.create {
        title = title,
        message = 'In progress...',
        lsp_client = {
          name = _get_role_name(request.data.adapter),
        },
      }
    end
    local function report_exit_status(handle, request)
      if request.data.status == 'success' then
        handle.message = 'Completed'
      elseif request.data.status == 'error' then
        handle.message = ' Error'
      else
        handle.message = '󰜺 Cancelled'
      end
    end
    local group = vim.api.nvim_create_augroup('CodeCompanionFidgetHooks', {})
    vim.api.nvim_create_autocmd({ 'User' }, {
      pattern = 'CodeCompanionRequestStarted',
      group = group,
      callback = function(request)
        local handle = _create_handle(request)
        _register_handle(request.data.id, handle)
      end,
    })
    vim.api.nvim_create_autocmd({ 'User' }, {
      pattern = 'CodeCompanionRequestFinished',
      group = group,
      callback = function(request)
        local handle = _pop_handle(request.data.id)
        if handle then
          report_exit_status(handle, request)
          handle:finish()
        end
      end,
    })
  end,
}
