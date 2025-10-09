return {
	config = function()
		require('better_escape').setup {
			-- NOTE: setting for this issue: https://github.com/kdheepak/lazygit.nvim/issues/146
			timeout = vim.o.timeoutlen,
			default_mappings = false,
			mappings = {
				i = { j = { j = "<Esc>" } },
			},
		}
	end
}
