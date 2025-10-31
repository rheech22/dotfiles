return {
	config = function()
		require('render-markdown').setup {
			file_types = {
				'markdown',
				'markdown.mdx',
				'vimwiki',
				'mdx',
				'codecompanion',
			},
			heading = {
				sign = false,
				icons = {},
			},
			code = {
				sign = false,
				width = 'block',
				right_pad = 1,
			},
			checkbox = {
				enabled = false,
			},
			latex = {
				enabled = true,
				render_modes = true,
				converter = 'latex2text',
				highlight = 'RenderMarkdownMath',
				position = 'top',
				top_pad = 1,
				bottom_pad = 1,
			},
		}
	end,
}
