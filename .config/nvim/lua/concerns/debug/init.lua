local M = {}

function M.continue()
  require('dap').continue()
end

function M.toggle_breakpoint()
  require('dap').toggle_breakpoint()
end

function M.step_into()
  require('dap').step_into()
end

function M.step_over()
  require('dap').step_over()
end

function M.step_out()
  require('dap').step_out()
end

function M.terminate()
  require('dap').terminate()
end

function M.toggle_view()
  require('dap-view').toggle()
end

function M.flutter_run()
  vim.cmd 'FlutterRun'
end

function M.flutter_quit()
  vim.cmd 'FlutterQuit'
end

function M.flutter_reload()
  vim.cmd 'FlutterReload'
end

function M.flutter_restart()
  vim.cmd 'FlutterRestart'
end

function M.flutter_pub_get()
  vim.cmd 'FlutterPubGet'
end

function M.flutter_codegen()
  vim.cmd '!dart run build_runner build --delete-conflicting-outputs'
end

return M
