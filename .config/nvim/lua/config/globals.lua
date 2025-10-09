vim.g.mapleader = " "
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- plugin:markdown preview
vim.g.mkdp_markdown_css = '~/.config/nvim/markdown_preview_styles.css'

-- plugin:vimwiki
vim.g.vimwiki_list = {
	{
		path = vim.fn.expand("~/Library/Mobile Documents/com~apple~CloudDocs/Notes"),
		ext = ".md",
		diary_rel_path = "retrospectives",
	},
}
vim.g.vimwiki_ext2syntax = {
	[".md"] = "markdown",
	[".mdx"] = "markdown",
}
