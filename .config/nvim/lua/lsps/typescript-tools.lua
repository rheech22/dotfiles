return {
	config = function()
		require('typescript-tools').setup {
			settings = {
				tsserver_plugins = {
					"@styled/typescript-styled-plugin",
				},
			},
		}
	end
}
