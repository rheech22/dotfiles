local M = {}

local HOME = os.getenv("HOME")
local CACHE_DIR = HOME .. "/.cache"
local THEME_STATE_PATH = CACHE_DIR .. "/theme.txt"

function M.load_state()
	local file = io.open(THEME_STATE_PATH, "r")
	if file then
		local scheme = file:read("*all"):gsub("%s+", "")
		file:close()
		return scheme
	end
	return "vague"
end

function M.save_state(scheme)
	os.execute("mkdir -p " .. CACHE_DIR)
	local file = io.open(THEME_STATE_PATH, "w")
	if file then
		file:write(scheme)
		file:close()
	end
end

return M
