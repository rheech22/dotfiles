return {
	config = function()
		require('copilot').setup({
			panel = {
				enabled = false,
			},
			nes = {
				enabled = false,
			},
			suggestion = {
				enabled = true,
				auto_trigger = true,
				hide_during_completion = true,
				debounce = 10,
				trigger_on_accept = true,
				keymap = {
					accept_word = false,
					accept_line = false,
					accept = "<M-y>",
					dismiss = "<M-n>",
					prev = "<M-k>",
					next = "<M-j>",
				},
			},
		})
	end,
}
