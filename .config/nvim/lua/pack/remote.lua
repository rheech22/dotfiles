require 'pack.types'

local M = {}

local STATE_FILE = vim.fn.stdpath 'state' .. '/pack-remote-state.json'
local DEFAULT_TTL = 7 * 24 * 60 * 60

---@param cmd string[]
---@return boolean, string
local function run_git(cmd)
  local out = vim.system(vim.list_extend({ 'git' }, cmd), { text = true }):wait()
  if out.code ~= 0 then
    return false, vim.trim(out.stderr or out.stdout or '')
  end

  return true, vim.trim(out.stdout or '')
end

---@param cmd string[]
---@param cb fun(ok: boolean, output: string)
local function run_git_async(cmd, cb)
  vim.system(vim.list_extend({ 'git' }, cmd), { text = true }, function(out)
    local ok = out.code == 0
    local output = vim.trim((ok and out.stdout or out.stderr or out.stdout) or '')
    vim.schedule(function()
      cb(ok, output)
    end)
  end)
end

---@param version string
---@return boolean
local function is_commitish(version)
  return version:match('^[0-9a-fA-F]+$') ~= nil and #version >= 7
end

---@return RemoteStateMap
function M.read()
  local file = io.open(STATE_FILE, 'r')
  if not file then
    return {}
  end

  local content = file:read '*a'
  file:close()

  local ok, decoded = pcall(vim.json.decode, content)
  if not ok or type(decoded) ~= 'table' then
    return {}
  end

  return decoded
end

---@param state RemoteStateMap
---@return boolean
function M.write(state)
  vim.fn.mkdir(vim.fn.fnamemodify(STATE_FILE, ':h'), 'p')

  local ok, json = pcall(vim.json.encode, state)
  if not ok then
    return false
  end

  local file = io.open(STATE_FILE, 'w')
  if not file then
    return false
  end

  file:write(json)
  file:close()
  return true
end

---@param repo string
---@return boolean
function M.clear_repo(repo)
  local state = M.read()
  state[repo] = nil
  return M.write(state)
end

---@param source_url string
---@return string|nil, string|nil
local function default_branch(source_url)
  local ok, output = run_git { 'ls-remote', '--symref', source_url, 'HEAD' }
  if not ok then
    return nil, output
  end

  local branch = output:match('ref:%s+refs/heads/([^%s]+)%s+HEAD')
  if not branch then
    return nil, 'Failed to resolve remote default branch'
  end

  return branch, nil
end

---@param source_url string
---@param cb fun(branch: string|nil, err: string|nil)
local function default_branch_async(source_url, cb)
  run_git_async({ 'ls-remote', '--symref', source_url, 'HEAD' }, function(ok, output)
    if not ok then
      cb(nil, output)
      return
    end

    local branch = output:match('ref:%s+refs/heads/([^%s]+)%s+HEAD')
    if not branch then
      cb(nil, 'Failed to resolve remote default branch')
      return
    end

    cb(branch, nil)
  end)
end

---@param source_url string
---@param ref string
---@return string|nil, string|nil
local function remote_rev(source_url, ref)
  local ok, output = run_git { 'ls-remote', source_url, ref }
  if not ok then
    return nil, output
  end

  local rev = output:match('^([0-9a-fA-F]+)%s+')
  if not rev then
    return nil, ('Remote ref not found: %s'):format(ref)
  end

  return rev, nil
end

---@param source_url string
---@param ref string
---@param cb fun(rev: string|nil, err: string|nil)
local function remote_rev_async(source_url, ref, cb)
  run_git_async({ 'ls-remote', source_url, ref }, function(ok, output)
    if not ok then
      cb(nil, output)
      return
    end

    local rev = output:match('^([0-9a-fA-F]+)%s+')
    if not rev then
      cb(nil, ('Remote ref not found: %s'):format(ref))
      return
    end

    cb(rev, nil)
  end)
end

---@param source_url string
---@param version string|nil
---@return string|nil, string|nil, string|nil, 'unknown'|'pinned'|'error'
local function resolve_remote_target(source_url, version)
  if version and version ~= '' then
    if is_commitish(version) then
      return nil, nil, nil, 'pinned'
    end

    local branch_ref = 'refs/heads/' .. version
    local branch_rev, branch_err = remote_rev(source_url, branch_ref)
    if branch_rev then
      return branch_ref, branch_rev, nil, 'unknown'
    end

    local annotated_tag_ref = 'refs/tags/' .. version .. '^{}'
    local annotated_tag_rev = remote_rev(source_url, annotated_tag_ref)
    if annotated_tag_rev then
      return annotated_tag_ref, annotated_tag_rev, nil, 'unknown'
    end

    local tag_ref = 'refs/tags/' .. version
    local tag_rev = remote_rev(source_url, tag_ref)
    if tag_rev then
      return tag_ref, tag_rev, nil, 'unknown'
    end

    return nil, nil, branch_err or ('Remote version not found: %s'):format(version), 'error'
  end

  local branch, branch_err = default_branch(source_url)
  if not branch then
    return nil, nil, branch_err, 'error'
  end

  local ref = 'refs/heads/' .. branch
  local rev, rev_err = remote_rev(source_url, ref)
  if not rev then
    return nil, nil, rev_err, 'error'
  end

  return ref, rev, nil, 'unknown'
end

---@param source_url string
---@param version string|nil
---@param cb fun(ref: string|nil, rev: string|nil, err: string|nil, status: 'unknown'|'pinned'|'error')
local function resolve_remote_target_async(source_url, version, cb)
  if version and version ~= '' then
    if is_commitish(version) then
      cb(nil, nil, nil, 'pinned')
      return
    end

    local branch_ref = 'refs/heads/' .. version
    remote_rev_async(source_url, branch_ref, function(branch_rev, branch_err)
      if branch_rev then
        cb(branch_ref, branch_rev, nil, 'unknown')
        return
      end

      local annotated_tag_ref = 'refs/tags/' .. version .. '^{}'
      remote_rev_async(source_url, annotated_tag_ref, function(annotated_tag_rev)
        if annotated_tag_rev then
          cb(annotated_tag_ref, annotated_tag_rev, nil, 'unknown')
          return
        end

        local tag_ref = 'refs/tags/' .. version
        remote_rev_async(source_url, tag_ref, function(tag_rev)
          if tag_rev then
            cb(tag_ref, tag_rev, nil, 'unknown')
            return
          end

          cb(nil, nil, branch_err or ('Remote version not found: %s'):format(version), 'error')
        end)
      end)
    end)
    return
  end

  default_branch_async(source_url, function(branch, branch_err)
    if not branch then
      cb(nil, nil, branch_err, 'error')
      return
    end

    local ref = 'refs/heads/' .. branch
    remote_rev_async(source_url, ref, function(rev, rev_err)
      if not rev then
        cb(nil, nil, rev_err, 'error')
        return
      end

      cb(ref, rev, nil, 'unknown')
    end)
  end)
end

---@param plugin ManagedPluginState
---@param cached RemoteState|nil
---@param ttl_seconds number|nil
---@return boolean
function M.is_stale(plugin, cached, ttl_seconds)
  local ttl = ttl_seconds or DEFAULT_TTL
  if not cached then
    return true
  end

  if cached.current_rev ~= plugin.current_rev or cached.source_url ~= plugin.source_url or cached.requested_version ~= plugin.requested_version then
    return true
  end

  if not cached.checked_at then
    return true
  end

  return (os.time() - cached.checked_at) >= ttl
end

---@param plugin ManagedPluginState
---@return RemoteState
function M.check(plugin)
  local state = {
    current_rev = plugin.current_rev,
    source_url = plugin.source_url,
    requested_version = plugin.requested_version,
    remote_ref = nil,
    remote_rev = nil,
    update_available = nil,
    status = 'unknown',
    checked_at = os.time(),
    error = nil,
  }

  if not plugin.source_url or plugin.source_url == '' then
    state.status = 'error'
    state.error = 'Missing source URL'
    return state
  end

  local ref, rev, err, status = resolve_remote_target(plugin.source_url, plugin.requested_version)
  state.remote_ref = ref
  state.remote_rev = rev
  state.status = status
  state.error = err

  if status == 'pinned' then
    state.update_available = false
    return state
  end

  if status == 'error' then
    return state
  end

  if not plugin.current_rev or plugin.current_rev == '' then
    state.status = 'unknown'
    return state
  end

  state.update_available = plugin.current_rev ~= rev
  state.status = state.update_available and 'available' or 'latest'
  return state
end

---@param plugin ManagedPluginState
---@return RemoteState
function M.check_and_store(plugin)
  local all = M.read()
  local result = M.check(plugin)
  all[plugin.repo] = result
  M.write(all)
  return result
end

---@param plugins ManagedPluginState[]
---@return RemoteStateMap
function M.check_all_and_store(plugins)
  local all = M.read()
  for _, plugin in ipairs(plugins) do
    all[plugin.repo] = M.check(plugin)
  end
  M.write(all)
  return all
end

---@param plugin ManagedPluginState
---@param cb fun(result: RemoteState)
function M.check_async(plugin, cb)
  local state = {
    current_rev = plugin.current_rev,
    source_url = plugin.source_url,
    requested_version = plugin.requested_version,
    remote_ref = nil,
    remote_rev = nil,
    update_available = nil,
    status = 'unknown',
    checked_at = os.time(),
    error = nil,
  }

  if not plugin.source_url or plugin.source_url == '' then
    state.status = 'error'
    state.error = 'Missing source URL'
    cb(state)
    return
  end

  resolve_remote_target_async(plugin.source_url, plugin.requested_version, function(ref, rev, err, status)
    state.remote_ref = ref
    state.remote_rev = rev
    state.status = status
    state.error = err

    if status == 'pinned' then
      state.update_available = false
      cb(state)
      return
    end

    if status == 'error' then
      cb(state)
      return
    end

    if not plugin.current_rev or plugin.current_rev == '' then
      state.status = 'unknown'
      cb(state)
      return
    end

    state.update_available = plugin.current_rev ~= rev
    state.status = state.update_available and 'available' or 'latest'
    cb(state)
  end)
end

---@param plugins ManagedPluginState[]
---@param opts? { ttl_seconds?: number, concurrency?: number, on_done?: fun(updated: integer, total: integer) }
function M.refresh_stale_async(plugins, opts)
  opts = opts or {}
  local all = M.read()
  local queue = {}
  for _, plugin in ipairs(plugins) do
    if M.is_stale(plugin, all[plugin.repo], opts.ttl_seconds) then
      queue[#queue + 1] = plugin
    end
  end

  if #queue == 0 then
    if opts.on_done then
      opts.on_done(0, 0)
    end
    return
  end

  local active = 0
  local idx = 1
  local updated = 0
  local concurrency = opts.concurrency or 3
  local done = false

  local function flush_if_done()
    if not done and idx > #queue and active == 0 then
      done = true
      M.write(all)
      if opts.on_done then
        opts.on_done(updated, #queue)
      end
    end
  end

  local function step()
    while active < concurrency and idx <= #queue do
      local plugin = queue[idx]
      idx = idx + 1
      active = active + 1

      M.check_async(plugin, function(result)
        all[plugin.repo] = result
        updated = updated + 1
        active = active - 1
        flush_if_done()
        step()
      end)
    end

    flush_if_done()
  end

  step()
end

function M.default_ttl_seconds()
  return DEFAULT_TTL
end

return M
