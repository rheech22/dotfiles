return {
	config = function()
		local _ = require 'fzf-lua'
		_.setup {
			winopts = {
				height = 0.75,
				width = 0.75,
				row = 0.5,
				col = 0.5,
				backdrop = 80,
			},
			files = {
				prompt = "",
				hidden = true,
				git_icons = true,
				no_header = true,
			},
			grep = {
				prompt = "",
				hidden = true,
			},
			buffers = {
				prompt = "",
			},
			oldfiles = {
				prompt = "",
			},
		}
		_.register_ui_select()
	end,
}
