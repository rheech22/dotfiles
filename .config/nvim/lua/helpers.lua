local M = {}

function M.github(repository)
	return 'https://github.com/' .. repository
end

function M.get_plugin_setting(plugins_dir, plugin)
	local ok, chunk = pcall(loadfile, plugins_dir .. plugin.name .. ".lua")
	if not ok or not chunk then return nil end
	local ok_setting, setting = pcall(chunk)
	if not ok_setting or type(setting) ~= "table" then return nil end
	return setting
end

return M
