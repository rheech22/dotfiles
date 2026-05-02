return {
  config = function()
    require('mole').setup {
      session_dir = vim.fn.expand('~/Dropbox/wiki' .. '/mole'),
      capture_mode = 'snippet',
      auto_open_panel = true,
      session_name = nil,
      virtual_text = false,
      picker = 'snacks',
      keys = {
        annotate = '<leader>ma', -- visual mode
        start_session = '<leader>ms', -- normal mode
        stop_session = '<leader>mq', -- normal mode
        resume_session = '<leader>mr', -- normal mode
        toggle_window = '<leader>mw', -- normal mode
        jump_to_location = { '<CR>', 'gd' }, -- in side panel
        next_annotation = ']a', -- in side panel
        prev_annotation = '[a', -- in side panel
      },
      window = { width = 0.3 },
      input = {
        width = 50,
        border = 'rounded',
        expand_key = '<C-e>', -- expand to a multiline floating buffer
      },
      format = {
        -- info: { title, file_path, cwd, timestamp }
        header = function(info)
          return {
            '# ' .. info.title,
            '',
            '**File:** ' .. info.file_path,
            '**Started:** ' .. info.timestamp,
            '**Project:** ' .. info.cwd, -- used to resolve file paths when jumping to locations from a different project
            '',
            '---',
          }
        end,
        footer = function(info)
          return {
            '',
            '---',
            '',
            '**Ended:** ' .. info.timestamp,
          }
        end,
        resumed = function(info)
          return {
            '',
            '---',
            '',
            '**Resumed:** ' .. info.timestamp,
            '',
            '---',
            '',
          }
        end,
      },
    }
  end,
}
