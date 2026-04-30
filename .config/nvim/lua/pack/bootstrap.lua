local pack = require 'pack'
local pending = require 'pack.pending'
local specs = require 'pack.specs'

for name in pairs(pending.list()) do
  local ok, err = pcall(vim.pack.del, { name }, { force = false })
  if ok then
    pending.remove(name)
  else
    vim.notify(('[pack] pending deletion %s failed: %s'):format(name, err), vim.log.levels.WARN)
  end
end

pack.install {
  plugins = specs.load 'lsps',
}

pack.install {
  plugins = specs.load 'plugins',
}

require('pack.background').setup()
require('pack.scaffold').setup()
