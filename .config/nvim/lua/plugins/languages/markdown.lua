return {
  {
    'stevearc/conform.nvim',
    optional = true,
    opts = {
      formatters = {
        ['markdown-toc'] = {
          condition = function(_, ctx)
            for _, line in
              ipairs(vim.api.nvim_buf_get_lines(ctx.buf, 0, -1, false))
            do
              if line:find '<!%-%- toc %-%->' then
                return true
              end
            end
          end,
        },
        ['markdownlint-cli2'] = {
          condition = function(_, ctx)
            local diag = vim.tbl_filter(function(d)
              return d.source == 'markdownlint'
            end, vim.diagnostic.get(ctx.buf))
            return #diag > 0
          end,
        },
      },
      formatters_by_ft = {
        ['markdown'] = { 'prettier', 'markdownlint-cli2', 'markdown-toc' },
        ['markdown.mdx'] = { 'prettier', 'markdownlint-cli2', 'markdown-toc' },
        ['mdx'] = { 'prettier', 'markdownlint-cli2', 'markdown-toc' },
        ['vimwiki'] = { 'markdown-toc' },
        ['codecompanion'] = { 'prettier', 'markdownlint-cli2', 'markdown-toc' },
      },
    },
  },
  {
    'williamboman/mason.nvim',
    opts = { ensure_installed = { 'markdownlint-cli2', 'markdown-toc' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        marksman = {},
      },
    },
  },
  {
    'MeanderingProgrammer/render-markdown.nvim',
    opts = {
      file_types = {
        'markdown',
        'markdown.mdx',
        'vimwiki',
        'mdx',
        'codecompanion',
      },
      code = {
        sign = false,
        width = 'block',
        right_pad = 1,
      },
      heading = {
        sign = false,
        icons = {},
      },
      checkbox = {
        enabled = false,
      },
      latex = {
        enabled = true,
        render_modes = true,
        converter = 'latex2text',
        highlight = 'RenderMarkdownMath',
        position = 'top',
        top_pad = 1,
        bottom_pad = 1,
      },
    },
    ft = {
      'markdown',
      'norg',
      'rmd',
      'org',
      'markdown.mdx',
      'mdx',
      'codecompanion',
    },
    config = function(_, opts)
      require('render-markdown').setup(opts)
      Snacks.toggle({
        name = 'Render Markdown',
        get = function()
          return require('render-markdown.state').enabled
        end,
        set = function(enabled)
          local m = require 'render-markdown'
          if enabled then
            m.enable()
          else
            m.disable()
          end
        end,
      }):map '<leader>um'
    end,
  },
  -- TODO: keep track of this issue for mdx: https://github.com/iamcco/markdown-preview.nvim/issues/547
  {
    'iamcco/markdown-preview.nvim',
    cmd = { 'MarkdownPreviewToggle', 'MarkdownPreview', 'MarkdownPreviewStop' },
    ft = { 'markdown' },
    build = function()
      vim.fn['mkdp#util#install']()
    end,
    config = function()
      vim.g.mkdp_markdown_css = '~/.config/nvim/markdown_preview_styles.css'
    end,
  },
}
