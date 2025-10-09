return {
	config = function()
		require('vague').setup {
			transparent = true
		}
		vim.cmd 'colorscheme vague'
	end
}
