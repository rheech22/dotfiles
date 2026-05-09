return {
  config = function()
    local wiki_path = vim.fn.expand(
      os.getenv 'HOME_WIKI_PATH' or '~/Library/CloudStorage/GoogleDrive-rheech22@gmail.com/My Drive/wiki'
    )
    local timestamp = function()
      return os.date '%Y-%m-%d %H:%M:%S +0900'
    end

    require('mole').setup {
      session_dir = wiki_path .. '/zt/fleeting/mole',
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
            '---',
            'created: ' .. timestamp(),
            'updated: ' .. timestamp(),
            'title: ' .. info.title,
            'tags: []',
            '---',
            '',
            '# ' .. info.title,
            '',
            '**File:** ' .. info.file_path,
            '**Started:** ' .. info.timestamp,
            '**Project:** ' .. info.cwd,
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
