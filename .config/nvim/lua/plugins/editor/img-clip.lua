return {
  'HakonHarnes/img-clip.nvim',
  event = 'VeryLazy',
  opts = {
    default = {
      file_name = '%Y-%m-%d-%H-%M-%S', ---@type string | fun(): string
      relative_to_current_file = true, ---@type boolean | fun(): boolean
      prompt_for_file_name = false, ---@type boolean | fun(): boolean
    },
    filetypes = {
      markdown = {
        url_encode_path = true, ---@type boolean
        template = '![$FILE_NAME]($FILE_PATH)', ---@type string
      },
      mdx = {
        url_encode_path = true, ---@type boolean
        template = '![$FILE_NAME]($FILE_PATH)', ---@type string
      },
    },
  },
  keys = {
    -- suggested keymap
    {
      '<leader>P',
      '<cmd>PasteImage<cr>',
      desc = 'Paste image from system clipboard',
    },
  },
}
