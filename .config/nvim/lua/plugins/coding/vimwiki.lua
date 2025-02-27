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
        {
          path = '~/Documents/gdrive',
          ext = '.md',
          diary_rel_path = 'retrospectives',
        },
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
        { '\\wi', '<Plug>VimwikiDiaryIndex', desc = 'Go to DiaryIndex' },
        {
          '\\w\\w',
          '<Plug>VimwikiMakeDiaryNote',
          desc = 'Create a Dairy Note',
        },
        {
          '\\w\\g',
          '<Plug>VimwikiDiaryGenerateLinks',
          desc = 'Generate Links for Diary Notes',
        },
        { '\\]', '<Plug>VimwikiToggleListItem' },
      }
    end,
  },
}
