return {
  -- https://github.com/greggh/claude-code.nvim
  'greggh/claude-code.nvim',
  enabled = false,
  dependencies = {
    'nvim-lua/plenary.nvim', -- Required for git operations
  },
  config = function()
    require('claude-code').setup {
      -- Terminal window settings
      window = {
        split_ratio = 0.4, -- Percentage of screen for the terminal window (height for horizontal, width for vertical splits)
        position = 'float', -- Position of the window: "botright", "topleft", "vertical", "float", etc.
        float = {
          width = '90%', -- Take up 90% of the editor width
          height = '90%', -- Take up 90% of the editor height
          row = 'center', -- Center vertically
          col = 'center', -- Center horizontally
          relative = 'editor',
          border = 'double', -- Use double border style
        },
      },
      -- File refresh settings
      refresh = {
        enable = true, -- Enable file change detection
        updatetime = 100, -- updatetime when Claude Code is active (milliseconds)
        timer_interval = 1000, -- How often to check for file changes (milliseconds)
        show_notifications = true, -- Show notification when files are reloaded
      },
      -- Git project settings
      git = {
        use_git_root = true, -- Set CWD to git root when opening Claude Code (if in git project)
      },
      -- Command variants
      command_variants = {
        continue = '--continue', -- Resume the most recent conversation
        resume = '--resume', -- Display an interactive conversation picker
        verbose = '--verbose', -- Enable verbose logging with full turn-by-turn output
      },
      -- Keymaps
      keymaps = {
        toggle = {
          normal = '<C-,>', -- Normal mode keymap for toggling Claude Code, false to disable
          terminal = '<C-,>', -- Terminal mode keymap for toggling Claude Code, false to disable
          variants = {
            continue = '<leader>cc', -- Normal mode keymap for Claude Code with continue flag
            verbose = '<leader>cv', -- Normal mode keymap for Claude Code with verbose flag
          },
        },
      },
    }
  end,
}
