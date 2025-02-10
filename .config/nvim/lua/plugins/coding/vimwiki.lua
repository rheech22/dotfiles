return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = {
      config = function()
        -- register vimwiki for highlighting in vimwiki
        vim.treesitter.language.register('markdown', 'vimwiki')
      end,
    },
  },
  {
    'vimwiki/vimwiki',
    branch = 'dev',
    init = function()
      vim.g.vimwiki_list = {
        { path = '~/Projects/rheech22.github.io/src/wikis', ext = '.md' },
        { path = '~/Projects/conerstone/src/app/blog/markdown', ext = '.mdx' },
      }
      vim.g.vimwiki_ext2syntax = {
        ['.md'] = 'markdown',
        ['.markdown'] = 'markdown',
        ['.mdx'] = 'markdown',
      }
    end,
    keys = function()
      return {
        { '\\ww', '<Plug>VimwikiIndex', desc = 'Go to WikiIndex' },
        { '\\]', '<Plug>VimwikiToggleListItem' },
      }
    end,
  },
}
