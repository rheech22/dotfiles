return {
	"mfussenegger/nvim-dap",
	config = function()
		local dap = require('dap')
		local mason_registry = require('mason-registry')
		local mason_daps_dir = vim.fn.stdpath('data') .. '/mason/packages'

		-- javascript
		if mason_registry.is_installed('js-debug-adapter') then
			local dap_executable = mason_daps_dir .. "/js-debug-adapter/js-debug/src/dapDebugServer.js"

			for _, type in ipairs({ "pwa-node", "pwa-chrome" }) do
				dap.adapters[type] = {
					type = "server",
					host = "localhost",
					port = "${port}",
					executable = {
						command = "node",
						args = { dap_executable, "${port}" },
					}
				}
			end
		end

		for _, language in ipairs({ "typescript", "javascript", "typescriptreact" }) do
			dap.configurations[language] = {
				-- https://github.com/serranomorante/.dotfiles/blob/main/docs/nvim-dap-node-cli.md
				{
					name = "Launch Chrome",
					type = "pwa-chrome",
					request = "launch",
					url = "http://localhost:5173",
					webRoot = "${workspaceFolder}",
					sourceMaps = true,
				},
				{
					name = "Launch Node(TS)",
					type = "pwa-node",
					request = "launch",
					preLaunchTask = "tsc: build - tsconfig.json",
					stopOnEntry = true,
					program = "${file}",
					cwd = "${workspaceFolder}",
					args = { "${workspaceFolder}/dist/index.js" },
					-- trace = true,
				},
				{
					name = "Launch Node",
					type = "pwa-node",
					request = "launch",
					stopOnEntry = true,
					program = "${file}",
					cwd = "${workspaceFolder}",
					-- trace = true,
				},
			}
		end
		-- dart/flutter
		-- flutter configurations are in ../lsp/flutter_tools.lua
		for _, type in ipairs({ "dart", "flutter" }) do
			dap.adapters[type] = {
				type = 'executable',
				command = type,
				args = { 'debug_adapter' },
			}
		end

		-- icon
		local dap_icons = {
			Stopped = { '󰁕 ', 'DiagnosticWarn', 'DapStoppedLine' },
			Breakpoint = ' ',
			BreakpointCondition = ' ',
			BreakpointRejected = { ' ', 'DiagnosticError' },
			LogPoint = '.>',
		}
		for name, sign in pairs(dap_icons) do
			sign = type(sign) == 'table' and sign or { sign }
			local text = sign[1]
			assert(type(text) == "string", "This 'text' must be a string")
			vim.fn.sign_define('Dap' .. name, {
				text = text,
				texthl = sign[2] or 'DiagnosticInfo',
				linehl = sign[3],
				numhl = sign[3],
			})
		end
	end
}
