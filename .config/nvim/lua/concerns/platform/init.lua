local Terminal = require('toggleterm.terminal').Terminal
local ui = require 'pack.ui'

local M = {}

local float_terms = {}
local float_idx = 0
local BASE_COUNT = 100
local title_timer = nil

local SHELL_NAMES = {
  zsh = true,
  bash = true,
  fish = true,
  sh = true,
  ['zsh-'] = true,
  ['-zsh'] = true,
  ['-bash'] = true,
  ['bash-'] = true,
}

local function get_term_cwd(pid)
  local output = vim.fn.systemlist(string.format('lsof -p %d -Fn 2>/dev/null | grep "^n/" | head -1 | cut -c2-', pid))
  if output[1] and output[1] ~= '' then
    return vim.fn.fnamemodify(output[1], ':~')
  end
  return nil
end

local function get_term_label(term)
  if not term or not term.bufnr or not vim.api.nvim_buf_is_valid(term.bufnr) then
    return 'terminal'
  end

  local pid = term.job_pid
  if not pid or pid <= 0 then
    local chan = vim.bo[term.bufnr].channel
    if chan and chan > 0 then
      local ok, resolved = pcall(vim.fn.jobpid, chan)
      if ok and resolved and resolved > 0 then
        pid = resolved
      end
    end
  end

  if pid and pid > 0 then
    local output = vim.fn.systemlist(string.format('pgrep -P %d -l 2>/dev/null', pid))
    for _, line in ipairs(output) do
      local name = line:match '^%d+%s+(.+)$'
      if name and name ~= '' and not SHELL_NAMES[name] then
        return name
      end
    end
  end

  local dir = term.dir or vim.fn.getcwd()
  if pid and pid > 0 then
    local cwd = get_term_cwd(pid)
    if cwd then
      return cwd
    end
  end
  return vim.fn.fnamemodify(dir, ':~')
end

local function get_float_win()
  for _, term in ipairs(float_terms) do
    if term.window and vim.api.nvim_win_is_valid(term.window) then
      return term.window
    end
  end
  return nil
end

local function update_title_now()
  if title_timer then
    vim.fn.timer_stop(title_timer)
    title_timer = nil
  end
  local win = get_float_win()
  if not win or not vim.api.nvim_win_is_valid(win) then
    return
  end
  if not float_terms[float_idx] then
    return
  end
  local label = get_term_label(float_terms[float_idx])
  vim.api.nvim_win_set_config(win, {
    title = string.format(' %d/%d · %s ', float_idx, #float_terms, label),
    title_pos = 'right',
  })
end

local function update_title()
  if title_timer then
    vim.fn.timer_stop(title_timer)
  end
  title_timer = vim.fn.timer_start(500, function()
    title_timer = nil
    update_title_now()
  end)
end

local function close_float_win()
  local win = get_float_win()
  if win and vim.api.nvim_win_is_valid(win) then
    vim.api.nvim_win_close(win, true)
  end
  for _, t in ipairs(float_terms) do
    t.window = nil
  end
end

local function open_float_at(idx)
  if idx < 1 or idx > #float_terms then
    return
  end
  float_idx = idx
  local term = float_terms[idx]
  local win = get_float_win()
  if win and term.bufnr then
    vim.api.nvim_win_set_buf(win, term.bufnr)
    term.window = win
    update_title_now()
    vim.cmd 'startinsert'
  else
    if win then
      vim.api.nvim_win_close(win, true)
      for _, t in ipairs(float_terms) do
        t.window = nil
      end
    end
    term:open()
  end
end

local function remove_float_at(idx)
  local term = float_terms[idx]
  if not term then
    return
  end
  term:shutdown()
  table.remove(float_terms, idx)
  for i, t in ipairs(float_terms) do
    t.count = BASE_COUNT + i
  end
  if #float_terms == 0 then
    close_float_win()
    float_idx = 0
    return
  end
  if float_idx > #float_terms then
    float_idx = #float_terms
  elseif float_idx >= idx then
    float_idx = math.max(1, float_idx - 1)
  end
  open_float_at(float_idx)
end

function M.terminal_float()
  if #float_terms == 0 then
    M.new_float_term()
    return
  end
  local win = get_float_win()
  if win then
    close_float_win()
  else
    open_float_at(float_idx)
  end
end

function M.new_float_term()
  local win = get_float_win()
  local idx = #float_terms + 1
  local term = Terminal:new {
    direction = 'float',
    count = BASE_COUNT + idx,
    hidden = false,
    on_open = function()
      update_title_now()
    end,
    on_stdout = function()
      update_title()
    end,
    on_exit = function(t)
      for i, ft in ipairs(float_terms) do
        if ft == t then
          vim.schedule(function()
            remove_float_at(i)
          end)
          break
        end
      end
    end,
  }
  float_terms[idx] = term

  if win then
    if term.bufnr then
      vim.api.nvim_win_set_buf(win, term.bufnr)
      term.window = win
      float_idx = idx
      update_title_now()
      vim.cmd 'startinsert'
    else
      close_float_win()
      float_idx = idx
      term:open()
    end
  else
    float_idx = idx
    term:open()
  end
end

function M.close_float_term()
  if #float_terms == 0 then
    return
  end
  remove_float_at(float_idx)
end

function M.cycle_float(direction)
  if #float_terms <= 1 then
    return
  end
  local win = get_float_win()
  if not win then
    return
  end

  local next_idx
  if direction == 'next' then
    next_idx = (float_idx % #float_terms) + 1
  else
    next_idx = float_idx <= 1 and #float_terms or float_idx - 1
  end

  float_terms[float_idx].window = nil
  float_idx = next_idx
  local term = float_terms[next_idx]
  if not term.bufnr then
    close_float_win()
    term:open()
  else
    vim.api.nvim_win_set_buf(win, term.bufnr)
    term.window = win
    update_title_now()
    vim.cmd 'startinsert'
  end
end

function M.terminal_right()
  vim.cmd '1ToggleTerm direction=vertical'
end

function M.terminal_bottom()
  vim.cmd '2ToggleTerm direction=horizontal'
end

function M.select_terminal()
  local all_terms = require('toggleterm.terminal').get_all()
  if #all_terms == 0 then
    vim.notify('No terminals', vim.log.levels.INFO)
    return
  end

  local finder_items = {}
  for _, term in ipairs(all_terms) do
    local count = term.count or 0
    local direction = count >= BASE_COUNT and 'float' or (term.direction or 'unknown')
    local label = get_term_label(term)
    table.insert(finder_items, {
      text = string.format('%d %s · %s', count, direction, label),
      term = term,
    })
  end

  ui.pick {
    items = finder_items,
    title = 'Select terminal',
    format = 'text',
    confirm = function(picker, item)
      picker:close()
      if not item then
        return
      end
      vim.schedule(function()
        local term = item.term
        local count = term.count or 0
        if count >= BASE_COUNT then
          for i, ft in ipairs(float_terms) do
            if ft == term then
              local win = get_float_win()
              if win then
                float_terms[float_idx].window = nil
                vim.api.nvim_win_set_buf(win, term.bufnr)
                term.window = win
                float_idx = i
                update_title_now()
                vim.cmd 'startinsert'
              else
                open_float_at(i)
              end
              break
            end
          end
        else
          term:open()
        end
      end)
    end,
  }
end

function M.toggle_all()
  vim.cmd '1ToggleTerm'
  vim.cmd '2ToggleTerm'
end

function M.send_lines()
  require('toggleterm').send_lines_to_terminal('visual_lines', true, { args = vim.v.count })
end

function M.send_selection()
  require('toggleterm').send_lines_to_terminal('visual_selection', true, { args = vim.v.count })
end

vim.api.nvim_create_autocmd('TermEnter', {
  pattern = 'term://*toggleterm#*',
  callback = function()
    vim.defer_fn(update_title, 100)
  end,
})

return M
