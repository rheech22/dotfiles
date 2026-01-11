---@class Plugin
---@field repo string github repository name (e.g., "user/repo")
---@field name string | nil filename for plugin setup in setup_dir
---@field deps (Plugin|string)[] | nil plugin dependencies
---@field version string | nil git branch, tag, or commit hash
---@field build string | nil shell command to run in plugin directory after install
---@field provider_host string | nil default: https://github.com

---@class InstallerParams
---@field plugins (Plugin|string)[] plugins to install
---@field setup_dir string directory to locate plugin setup files

---@class BuildState
---@field last_built_commit string | nil git commit hash when last built
---@field last_built_time number | nil unix timestamp when last built
---@field build_success boolean | nil whether the last build succeeded

---@alias PluginRegistry table<string, 'installed' | 'configured'>
---@alias BuildStateMap table<string, BuildState>

return {}
