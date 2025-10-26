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
		local bullet_padding = string.rep(" ", 3)
		local add_item = function(to, name, action)
			return { name = name, action = action, section = to }
		end
		starter.setup {
			evaluate_single = true,
			items = {
				starter.sections.recent_files(5, false),
				starter.sections.recent_files(5, true),
				add_item('Shorcuts', 'Oil', 'Oil'),
				add_item('Shorcuts', 'Dotfiles', 'e ~/dotfiles'),
				add_item('Shorcuts', 'Wezterm', 'e ~/.config/wezterm'),
				add_item('Shorcuts', 'Zshrc', 'e ~/.config/zsh'),
				add_item('Shorcuts', 'Nvim', 'e ~/.config/nvim'),
				add_item('Shorcuts', 'Packages', 'e ~/.local/share/nvim/site/pack/core/opt/'),
			},
			content_hooks = {
				starter.gen_hook.adding_bullet(bullet_padding .. "░ ", false),
				starter.gen_hook.aligning("center", "center"),
				starter.gen_hook.indexing("all", { 'Shorcuts' }),
			},
			header = 'Why...?',
			footer = '',
		}
	end,
}
