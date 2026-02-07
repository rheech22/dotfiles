local M = {}

local HOME = os.getenv("HOME")
local DOTFILES = HOME .. "/dotfiles"
local STARSHIP_THEMES_DIR = DOTFILES .. "/.config/starship/themes"
local LAZYGIT_THEMES_DIR = DOTFILES .. "/.config/lazygit/themes"
local STARSHIP_LINK_PATH = HOME .. "/.config/starship.toml"
local LAZYGIT_LINK_PATH = HOME .. "/.cache/lazygit-theme.yml"

local function file_exists(path)
	local file = io.open(path, "r")
	if file then
		file:close()
		return true
	end
	return false
end

local function shell_quote(s)
	return "'" .. s:gsub("'", "'\\''") .. "'"
end

local function command_ok(result)
	if type(result) == "number" then
		return result == 0
	end
	return result == true
end

local function ensure_parent_dir(path)
	local parent = path:match("(.+)/[^/]+$")
	if not parent then
		return true
	end
	return command_ok(os.execute("mkdir -p " .. shell_quote(parent)))
end

local function switch_symlink_atomic(link_path, target_path)
	if not ensure_parent_dir(link_path) then
		return false
	end

	local tmp_path = link_path .. ".tmp"
	os.remove(tmp_path)

	if not command_ok(os.execute("ln -sfn " .. shell_quote(target_path) .. " " .. shell_quote(tmp_path))) then
		return false
	end

	if not command_ok(os.execute("mv -f " .. shell_quote(tmp_path) .. " " .. shell_quote(link_path))) then
		return false
	end

	local file = io.open(link_path, "r")
	if not file then
		return false
	end
	file:close()
	return true
end

local function resolve_sync_scheme(scheme)
	local starship_target = STARSHIP_THEMES_DIR .. "/" .. scheme .. ".toml"
	local lazygit_target = LAZYGIT_THEMES_DIR .. "/" .. scheme .. ".yml"

	if file_exists(starship_target) and file_exists(lazygit_target) then
		return scheme
	end

	local fallback = "vague"
	local fallback_starship = STARSHIP_THEMES_DIR .. "/" .. fallback .. ".toml"
	local fallback_lazygit = LAZYGIT_THEMES_DIR .. "/" .. fallback .. ".yml"

	if file_exists(fallback_starship) and file_exists(fallback_lazygit) then
		return fallback
	end

	return nil
end

function M.sync_starship(scheme)
	local wezterm = require("wezterm")
	local target = STARSHIP_THEMES_DIR .. "/" .. scheme .. ".toml"
	if not file_exists(target) then
		wezterm.log_warn("[Theme Sync] Starship: theme file not found for " .. scheme)
		return false
	end

	local ok = switch_symlink_atomic(STARSHIP_LINK_PATH, target)
	if not ok then
		wezterm.log_warn(string.format("[Theme Sync] Starship: failed to switch symlink for %s", scheme))
		return false
	end

	wezterm.log_info(string.format("[Theme Sync] Starship: %s -> %s", scheme, STARSHIP_LINK_PATH))
	return true
end

function M.sync_lazygit(scheme)
	local wezterm = require("wezterm")
	local target = LAZYGIT_THEMES_DIR .. "/" .. scheme .. ".yml"
	if not file_exists(target) then
		wezterm.log_warn("[Theme Sync] Lazygit: theme file not found for " .. scheme)
		return false
	end

	local ok = switch_symlink_atomic(LAZYGIT_LINK_PATH, target)
	if not ok then
		wezterm.log_warn(string.format("[Theme Sync] Lazygit: failed to switch symlink for %s", scheme))
		return false
	end

	wezterm.log_info(string.format("[Theme Sync] Lazygit: %s -> %s", scheme, LAZYGIT_LINK_PATH))
	return true
end

function M.sync_external_tools(scheme)
	local wezterm = require("wezterm")
	local resolved = resolve_sync_scheme(scheme)
	if not resolved then
		wezterm.log_warn("[Theme Sync] Missing theme files and fallback is unavailable")
		return false, nil
	end

	local starship_ok = M.sync_starship(resolved)
	local lazygit_ok = M.sync_lazygit(resolved)
	if not (starship_ok and lazygit_ok) then
		wezterm.log_warn(string.format("[Theme Sync] External sync failed for %s", resolved))
		return false, resolved
	end

	if resolved ~= scheme then
		wezterm.log_info(string.format("[Theme Sync] Fallback: %s -> %s", scheme, resolved))
	end

	return true, resolved
end

return M
