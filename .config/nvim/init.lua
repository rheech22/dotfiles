-- add packages
vim.pack.add({
	{ src = "https://github.com/vague2k/vague.nvim" },
	{ src = "https://github.com/mason-org/mason.nvim" },
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter", branch = "main", build = ":TSUpdate" },
	{ src = "https://github.com/stevearc/oil.nvim" },
	{ src = "https://github.com/echasnovski/mini.pick" },
	{ src = "https://github.com/nvim-mini/mini.pairs" },
	{ src = "https://github.com/max397574/better-escape.nvim" },
	{ src = "https://github.com/folke/todo-comments.nvim" },
	{ src = "https://github.com/vimwiki/vimwiki",                 branch = "dev" },
	{ src = "https://github.com/lewis6991/gitsigns.nvim" },
	{ src = "https://github.com/hakonharnes/img-clip.nvim" },
	{ src = "https://github.com/nvim-lua/plenary.nvim" },
	{ src = "https://github.com/nvim-flutter/flutter-tools.nvim" },
	{ src = "https://github.com/esmuellert/nvim-eslint" },
	{ src = "https://github.com/iamcco/markdown-preview.nvim" },
})

-- setup packages
require "vague".setup({ transparent = true })

require "mason".setup()

require "oil".setup({
	lsp_file_methods = {
		enabled = true,
		timeout_ms = 1000,
		autosave_changes = true,
	},
	view_options = {
		show_hidden = true,
	},
	columns = {
		"permissions",
		"icon",
	},
	float = {
		max_width = 0.7,
		max_height = 0.6,
		border = "rounded",
	},
})

require "nvim-treesitter".setup({})
vim.treesitter.language.register('markdown', 'vimwiki')

require "mini.pick".setup()

require "mini.pairs".setup()

require "better_escape".setup()

require "todo-comments".setup({
	signs = false,
})

require "gitsigns".setup({
	current_line_blame = true
})

require "img-clip".setup({
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
})

require "flutter-tools".setup()

require "nvim-eslint".setup({})

-- set config
require "config.autocmds"
require "config.options"
require "config.globals"
require "config.keymaps"

-- enable lsp
vim.lsp.enable({ "lua_ls", "vtsls", "tailwindcss" })
