local M = {}

local HOME = os.getenv("HOME")
local STATE_DIR = HOME .. "/.local/state/dotfiles"
local THEME_STATE_PATH = STATE_DIR .. "/theme.txt"

local function read_state_file()
	local file = io.open(THEME_STATE_PATH, "r")
	if not file then
		return nil
	end

	local scheme = file:read("*all"):gsub("%s+", "")
	file:close()
	return scheme
end

local function write_with_io(scheme)
	os.execute("mkdir -p " .. STATE_DIR)
	local file = io.open(THEME_STATE_PATH, "w")
	if not file then
		return false
	end

	file:write(scheme)
	file:close()
	return read_state_file() == scheme
end

function M.load_state()
	local scheme = read_state_file()
	if scheme then
		return scheme
	end
	return "vague"
end

function M.save_state(scheme)
	return write_with_io(scheme)
end

return M
