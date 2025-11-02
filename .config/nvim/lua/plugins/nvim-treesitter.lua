return {
	config = function()
		local treesitter = require('nvim-treesitter')
		treesitter.setup({})
		treesitter.install({
			'lua',
			'vim',
			'vimdoc',
			'markdown',
			'markdown_inline',
			'css',
			'styled',
			'html',
			'yaml',
		})
		vim.treesitter.language.register('markdown', 'vimwiki')
	end,
}
