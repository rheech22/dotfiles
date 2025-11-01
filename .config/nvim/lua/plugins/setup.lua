local H = require 'helpers'

vim.g.vimwiki_list = {
	{
		path = vim.fn.expand '~/Library/Mobile Documents/com~apple~CloudDocs/Notes',
		ext = '.md',
		diary_rel_path = 'retrospectives',
	},
}

vim.g.vimwiki_ext2syntax = {
	['.md'] = 'markdown',
	['.mdx'] = 'markdown',
}

local plugins = {
	{ name = 'vague',              src = H.github 'vague2k/vague.nvim' },
	{ name = 'nvim-treesitter',    src = H.github 'nvim-treesitter/nvim-treesitter',          version = 'main' },
	{ name = 'treesitter-context', src = H.github 'nvim-treesitter/nvim-treesitter-context' },
	{ name = 'vimwiki',            src = H.github 'vimwiki/vimwiki',                          version = 'dev' },
	{ name = 'mini.pairs',         src = H.github 'nvim-mini/mini.pairs' },
	{ name = 'mini.icons',         src = H.github 'nvim-mini/mini.icons' },
	{ name = 'mini.starter',       src = H.github 'nvim-mini/mini.starter' },
	{ name = 'oil',                src = H.github 'stevearc/oil.nvim' },
	{ name = 'better-escape',      src = H.github 'max397574/better-escape.nvim' },
	{ name = 'todo-comments',      src = H.github 'folke/todo-comments.nvim' },
	{ name = 'gitsigns',           src = H.github 'lewis6991/gitsigns.nvim' },
	{ name = 'img-clip',           src = H.github 'hakonharnes/img-clip.nvim' },
	{ name = 'markdown-preview',   src = H.github 'iamcco/markdown-preview.nvim' },
	{ name = 'lazygit',            src = H.github 'kdheepak/lazygit.nvim' },
	{ name = 'dap',                src = H.github 'mfussenegger/nvim-dap' },
	{ name = 'dap-view',           src = H.github 'igorlfs/nvim-dap-view' },
	{ name = 'fidget',             src = H.github 'j-hui/fidget.nvim' },
	{ name = 'conform',            src = H.github 'stevearc/conform.nvim' },
	{ name = 'supermaven',         src = H.github 'supermaven-inc/supermaven-nvim' },
	{ name = 'codecompanion',      src = H.github 'olimorris/codecompanion.nvim' },
	{ name = 'render-markdown',    src = H.github 'MeanderingProgrammer/render-markdown.nvim' },
	{ name = 'smear-cursor',       src = H.github 'sphamba/smear-cursor.nvim' },
	{ name = 'fzf-lua',            src = H.github 'ibhagwan/fzf-lua' },
}

vim.pack.add(plugins)

local plugins_dir = vim.fn.stdpath 'config' .. '/lua/plugins/'
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
		if not spec then
			return
		end

		local kind = args.data.kind
		if kind ~= 'update' then
			return
		end

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
