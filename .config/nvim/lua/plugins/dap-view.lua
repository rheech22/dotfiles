return {
	config = function()
		require 'dap-view'.setup({
			winbar = {
				sections = { "watches", "scopes", "exceptions", "breakpoints", "threads", "repl" },
				default_section = "repl"
			}
		})
	end
}
