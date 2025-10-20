return {
	config = function()
		local workspace = os.getenv("WORKSPACE")
		local lookup_cmd = nil
		if workspace == "work" then
			lookup_cmd = "mise where flutter"
		end

		require('flutter-tools').setup {
			flutter_lookup_cmd = lookup_cmd,
			widget_guides = {
				enabled = true,
			},
			closing_tags = {
				highlight = 'Comment',
				prefix = '__',
			},
			dev_log = {
				enabled = false,
			},
			lsp = {
				color = {
					enabled = true,
					background_color = { r = 19, g = 17, b = 24 },
					virtual_text = true,
					virtual_text_str = '✪',
				},
				settings = {
					showTodos = false,
					renameFilesWithClasses = 'prompt',
					enableSnippets = true,
					updateImportsOnRename = true,
				},
			},
			debugger = {
				enabled = true,
				run_via_dap = true,
				exception_breakpoints = { 'all' },
				register_configurations = function(_)
					local dap = require 'dap'
					local with_webdev_flags = function(args)
						local flutter_webdev_flags = {
							'--web-browser-flag',
							'--disable-web-security',
							'--web-browser-flag',
							'--disable-site-isolation-trials',
						}
						return vim.list_extend(args, flutter_webdev_flags)
					end
					local flutter_configurations = {
						{
							name = 'Local build',
							args = with_webdev_flags {
								'--flavor=local',
								'--dart-define-from-file=.config/local/dart-define.json',
							},
						},
						{
							name = 'Local build (Release)',
							args = with_webdev_flags {
								'--release',
								'--flavor=local',
								'--dart-define-from-file=.config/local/dart-define.json',
							},
						},
						{
							name = 'Dev build',
							args = with_webdev_flags {
								'--flavor=dev',
								'--dart-define-from-file=.config/dev/dart-define.json',
							},
						},
						{
							name = 'Stage build',
							args = {
								'--flavor=stage',
								'--dart-define-from-file=.config/stage/dart-define.json',
							},
						},
						{
							name = 'Live build',
							args = {
								'--flavor=live',
								'--dart-define-from-file=.config/live/dart-define.json',
							},
						},
					}
					dap.configurations.dart = vim.tbl_map(function(config)
						return vim.tbl_extend('force', {
							type = 'flutter',
							request = 'launch',
							program = '${workspaceFolder}/lib/main.dart',
							cwd = '${workspaceFolder}',
						}, config)
					end, flutter_configurations)
				end,
			},
		}
	end,
}
