return {
  config = function()
    local fzf = require 'fzf-lua'
    fzf.setup {
      winopts = {
        height = 0.75,
        width = 0.75,
        row = 0.5,
        col = 0.5,
        backdrop = 50,
      },
      files = {
        prompt = '',
        hidden = true,
        git_icons = true,
        no_header = true,
      },
      grep = {
        prompt = '',
        hidden = true,
      },
      buffers = {
        prompt = '',
      },
      oldfiles = {
        prompt = '',
      },
    }

    local function pick_colorscheme()
      local themes = require 'plugins.theme'
      require('fzf-lua').fzf_exec(themes.available_themes, {
        prompt = 'Colorscheme> ',
        actions = {
          ['default'] = function(selected)
            if selected and selected[1] then
              themes.apply_theme(selected[1])
            end
          end,
        },
        fzf_opts = {
          ['--no-multi'] = '',
          ['--preview-window'] = 'hidden',
        },
      })
    end

    vim.keymap.set('n', '<leader>cs', pick_colorscheme, { desc = 'Pick colorscheme' })
  end,
}
