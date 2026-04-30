local M = {}

local function has_snacks()
  return pcall(require, 'snacks')
end

---@param items table[]
---@param opts { prompt: string, format_item?: function, snacks?: table }
---@param cb fun(choice: table|nil)
function M.select(items, opts, cb)
  if has_snacks() then
    require('snacks.picker.select').select(items, {
      prompt = opts.prompt,
      format_item = opts.format_item,
      snacks = opts.snacks,
    }, cb)
  else
    vim.ui.select(items, {
      prompt = opts.prompt,
      format_item = opts.format_item,
    }, cb)
  end
end

---@param opts { title: string, preview_text: string }
---@param cb fun(confirmed: boolean)
function M.confirm(opts, cb)
  if has_snacks() then
    local completed = false
    require('snacks').picker.pick {
      title = opts.title,
      items = {
        {
          text = 'Yes',
          value = true,
          preview = { text = opts.preview_text, ft = 'markdown', loc = false },
        },
        {
          text = 'No',
          value = false,
          preview = { text = opts.preview_text, ft = 'markdown', loc = false },
        },
      },
      format = 'text',
      preview = 'preview',
      layout = {
        preset = 'ivy',
        fullscreen = false,
      },
      win = {
        preview = {
          wo = {
            number = false,
            relativenumber = false,
            signcolumn = 'no',
          },
        },
      },
      confirm = function(picker, item)
        completed = true
        picker:close()
        cb(item and item.value == true or false)
      end,
      on_close = function()
        if not completed then
          cb(false)
        end
      end,
    }
  else
    vim.ui.select({ 'Yes', 'No' }, {
      prompt = opts.title,
    }, function(choice)
      cb(choice == 'Yes')
    end)
  end
end

---@param opts table snacks.picker.pick options
function M.pick(opts)
  if has_snacks() then
    require('snacks').picker.pick(opts)
    return
  end

  local items = opts.items or {}
  local prompt = opts.title or 'Select'

  local selectable = vim.tbl_filter(function(item)
    return not item.divider and not item.empty
  end, items)

  vim.ui.select(selectable, {
    prompt = prompt,
    format_item = function(item)
      return item.text or ''
    end,
  }, function(item)
    if not item or not opts.confirm then
      return
    end
    opts.confirm({ close = function() end, selected = function()
      return item and { item } or {}
    end }, item)
  end)
end

return M
