---@class Plugin
---@field repo string github repository name (e.g., "user/repo")
---@field name string | nil filename for plugin setup in setup_dir
---@field concern string | nil concern owner for setup resolution
---@field capabilities string[] | nil optional concern capabilities metadata
---@field deps (Plugin|string)[] | nil plugin dependencies
---@field version string | nil git branch, tag, or commit hash
---@field build string | nil shell command to run in plugin directory after install
---@field provider_host string | nil default: https://github.com
---@field config string | nil config filename override without .lua
---@field enabled boolean | nil default: true

---@class InstallerParams
---@field plugins (Plugin|string)[] plugins to install
---@field setup_dir string | nil directory to locate plugin setup files

---@class BuildState
---@field last_built_commit string | nil git commit hash when last built
---@field last_built_time number | nil unix timestamp when last built
---@field build_success boolean | nil whether the last build succeeded

---@class RemoteState
---@field current_rev string | nil
---@field source_url string | nil
---@field requested_version string | nil
---@field remote_ref string | nil
---@field remote_rev string | nil
---@field update_available boolean | nil
---@field status 'unknown' | 'available' | 'latest' | 'pinned' | 'error'
---@field checked_at number | nil
---@field error string | nil

---@alias PluginRegistry table<string, 'installed' | 'configured'>
---@alias BuildStateMap table<string, BuildState>
---@alias RemoteStateMap table<string, RemoteState>

---@class PendingDeletion
---@field repo string
---@field group string
---@field requested_at number
---@field is_orphan boolean
---@field plugin_dir string

return {}
