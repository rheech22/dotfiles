local H = require 'helpers'

local plugins = {
	{ name = 'vague',            src = H.github('vague2k/vague.nvim') },
	{ name = 'nvim-treesitter',  src = H.github('nvim-treesitter/nvim-treesitter'), version = 'main' },
	{ name = 'vimwiki',          src = H.github('vimwiki/vimwiki'),                 version = 'dev' },
	{ name = 'mini.pick',        src = H.github('echasnovski/mini.pick') },
	{ name = 'mini.pairs',       src = H.github('nvim-mini/mini.pairs') },
	{ name = 'mini.icons',       src = H.github('nvim-mini/mini.icons') },
	{ name = 'oil',              src = H.github('stevearc/oil.nvim') },
	{ name = 'better-escape',    src = H.github('max397574/better-escape.nvim') },
	{ name = 'todo-comments',    src = H.github('folke/todo-comments.nvim') },
	{ name = 'gitsigns',         src = H.github('lewis6991/gitsigns.nvim') },
	{ name = 'img-clip',         src = H.github('hakonharnes/img-clip.nvim') },
	{ name = 'markdown-preview', src = H.github('iamcco/markdown-preview.nvim') },
	{ name = 'lazygit',          src = H.github('kdheepak/lazygit.nvim') },
	{ name = 'dap',              src = H.github('mfussenegger/nvim-dap') },
	{ name = 'dap-view',         src = H.github('igorlfs/nvim-dap-view') },
}

vim.pack.add(plugins)

local plugins_dir = vim.fn.stdpath('config') .. '/lua/plugins/'
for _, plugin in ipairs(plugins) do
	local setting = H.get_plugin_setting(plugins_dir, plugin)
	if setting and setting.config then
		setting.config()
	end
end

vim.api.nvim_create_autocmd('PackChanged', {
	group = vim.api.nvim_create_augroup('pkgChange', { clear = true }),
	callback = function(args)
		local spec = args.data.spec
		if not spec then return end

		local kind = args.data.kind
		if kind ~= 'update' then return end

		local plugin_name = spec.name
		for _, plugin in ipairs(plugins) do
			local setting = H.get_plugin_setting(plugins_dir, plugin)
			if plugin.name == plugin_name and setting and setting.install then
				vim.schedule(setting.install)
				return
			end
		end
		vim.notify('Plugin ' .. plugin_name .. ' was updated but not found in plugin list', vim.log.levels.WARN)
	end,
})
