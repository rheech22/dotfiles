return {
  config = function()
    require('nvim-eslint').setup {
      settings = {
        workingDirectory = function(bufnr)
          return { directory = vim.fs.root(bufnr, { 'package.json' }) }
        end,
      },
    }
  end,
}
