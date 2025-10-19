return {
  config = function()
    require('img-clip').setup {
      default = {
        file_name = '%Y-%m-%d-%H-%M-%S',
        relative_to_current_file = true,
        prompt_for_file_name = false,
      },
      filetypes = {
        markdown = {
          url_encode_path = true,
          template = '![$FILE_NAME]($FILE_PATH)',
        },
        mdx = {
          url_encode_path = true,
          template = '![$FILE_NAME]($FILE_PATH)',
        },
      },
    }
  end,
}
