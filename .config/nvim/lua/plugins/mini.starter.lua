return {
	config = function()
		-- local header = table.concat({
		-- 	"	                     ",
		-- 	"       _.---._        ",
		-- 	"     .(((|||))).      ",
		-- 	"    (((//'~`\\)))     ",
		-- 	"    ))!_______!((     ",
		-- 	"   (((\\__/-\\__/)))    ",
		-- 	"    )))   L   (((     ",
		-- 	"   ((( \\  -  / )))    ",
		-- 	"    )))!`._.'!(((     ",
		-- 	"      /'     `\\       ",
		-- 	" _.-~' ._\\ /_. `~-._  ",
		-- 	"'        `.'        ` ",
		-- }, "\n")

		local starter = require('mini.starter')
		-- local bullet_padding = string.rep(" ", 3)
		local shortcut_section = 'Shortcuts'
		local add_item = function(to, name, action)
			return { name = name, action = action, section = to }
		end
		starter.setup {
			evaluate_single = true,
			items = {
				starter.sections.recent_files(5, true, false),
				starter.sections.recent_files(5, false),
				add_item(shortcut_section, 'Oil', 'Oil'),
				add_item(shortcut_section, 'Wezterm', 'e ~/.config/wezterm'),
				add_item(shortcut_section, 'Zshrc', 'e ~/.config/zsh'),
				add_item(shortcut_section, 'Nvim', 'e ~/.config/nvim'),
				add_item(shortcut_section, 'Packages', 'e ~/.local/share/nvim/site/pack/core/opt/'),
				add_item(shortcut_section, 'Vimwiki', 'VimwikiIndex 1'),
				add_item(shortcut_section, 'Daily', 'VimwikiDiaryIndex'),
				add_item(shortcut_section, '.(Dotfiles)', 'e ~/dotfiles'),
			},
			content_hooks = {
				-- starter.gen_hook.adding_bullet(bullet_padding .. "░ ", false),
				starter.gen_hook.aligning("center", "center"),
				starter.gen_hook.indexing("all", { shortcut_section }),
			},
			header = '',
			footer = '',
		}

		vim.api.nvim_create_autocmd('User', {
			group = vim.api.nvim_create_augroup('MiniStarterInitialization', { clear = true }),
			pattern = 'MiniStarterOpened',
			callback = function()
				vim.keymap.set('n', '<C-j>', "<Cmd>lua MiniStarter.update_current_item('next')<CR>", { buffer = true })
				vim.keymap.set('n', '<C-k>', "<Cmd>lua MiniStarter.update_current_item('prev')<CR>", { buffer = true })
			end,
		})
	end,
}
