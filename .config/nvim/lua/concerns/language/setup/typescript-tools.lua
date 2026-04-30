return {
  config = function()
    require('typescript-tools').setup {
      settings = {
        tsserver_file_preferences = {
          jsxAttributeCompletionStyle = 'none',
        },
        tsserver_plugins = {
          '@styled/typescript-styled-plugin',
        },
      },
    }
  end,
}
