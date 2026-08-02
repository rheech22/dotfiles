local M = {}

local dependencies
local inbox = hs.fs.temporaryDirectory() .. "whisper-voice-router/"
local normalizationQueue = {}
local normalizationTask
local processing = false

local simpleActions = {
  browser = "focusBrowser",
  ["브라우저"] = "focusBrowser",
  terminal = "focusTerminal",
  ["터미널"] = "focusTerminal",
  memo = "focusNotes",
  note = "focusNotes",
  notes = "focusNotes",
  ["메모"] = "focusNotes",
  ["노트"] = "focusNotes",
  youtube = "openYouTube",
  ["유튜브"] = "openYouTube",
  netflix = "openNetflix",
  ["넷플릭스"] = "openNetflix",
}

local windowActions = {
  left = "windowLeft",
  ["레프트"] = "windowLeft",
  right = "windowRight",
  ["라이트"] = "windowRight",
  up = "windowUp",
  ["업"] = "windowUp",
  down = "windowDown",
  ["다운"] = "windowDown",
  full = "windowFull",
  maximize = "windowFull",
  ["풀"] = "windowFull",
  ["맥시마이즈"] = "windowFull",
  minimize = "windowMinimize",
  minimise = "windowMinimize",
  ["미니마이즈"] = "windowMinimize",
}

local displayActions = {
  ["1"] = "display1",
  one = "display1",
  ["원"] = "display1",
  ["2"] = "display2",
  two = "display2",
  ["투"] = "display2",
  ["이"] = "display2",
}

local backAliases = {
  back = true,
  ["go back"] = true,
  ["고백"] = true,
  ["고 백"] = true,
  ["돌아가"] = true,
  ["백"] = true,
}

local searchAliases = {
  search = true,
  ["검색"] = true,
  ["서치"] = true,
}

local function asciiLower(value)
  return value:gsub("[A-Z]", string.lower)
end

local function trim(value)
  return value:match "^%s*(.-)%s*$"
end

local function canonicalize(value)
  local result = asciiLower(value)
  result = result:gsub("，", ",")
  result = result:gsub(",", " ")
  result = result:gsub("%s+", " ")
  result = trim(result)

  local changed = true
  while changed do
    changed = false
    for _, punctuation in ipairs({ ".", "!", "?", "。", "！", "？" }) do
      if result:sub(-#punctuation) == punctuation then
        result = result:sub(1, -#punctuation - 1)
        changed = true
      end
    end
  end

  return trim(result)
end

local function stripActionPrefix(value)
  value = value:gsub("，", ",")
  local lower = asciiLower(value)
  local _, prefixEnd = lower:find "^%s*action"
  if not prefixEnd then
    _, prefixEnd = lower:find "^%s*액션"
  end
  if not prefixEnd then
    return
  end

  local separator = value:sub(prefixEnd + 1, prefixEnd + 1)
  if separator ~= "" and not separator:match "[%s,]" then
    return
  end

  return value:sub(prefixEnd + 1):gsub("^[%s,]+", "")
end

local function startsWithAlias(value, aliases)
  for alias, action in pairs(aliases) do
    if value == alias or value:sub(1, #alias + 1) == alias .. " " then
      return action
    end
  end
end

local function extractSearch(remainder)
  remainder = remainder:gsub("，", ",")
  local lower = asciiLower(remainder)
  for alias in pairs(searchAliases) do
    if lower:sub(1, #alias) == alias then
      local separator = lower:sub(#alias + 1, #alias + 1)
      if separator:match "[%s,]" then
        local query = remainder:sub(#alias + 1):gsub("^[%s,]+", "")
        if query ~= "" then
          return query
        end
      end
    end
  end
end

function M.classify(rawText, processedText)
  local compact = canonicalize(rawText):gsub(" ", "")
  if compact == "actionback" or compact == "액션백" then
    return { kind = "action", name = "goBack", params = {} }
  end

  local remainder = stripActionPrefix(rawText)
  if not remainder then
    return { kind = "paste", text = processedText }
  end

  local query = extractSearch(remainder)
  if query then
    return {
      kind = "action",
      name = "searchGoogle",
      params = { query = query },
    }
  end

  local command = canonicalize(remainder)
  if backAliases[command] then
    return { kind = "action", name = "goBack", params = {} }
  end

  local action = startsWithAlias(command, simpleActions)
  if action then
    return { kind = "action", name = action, params = {} }
  end

  local windowCommand = command:match "^window (.+)$"
    or command:match "^윈도우 (.+)$"
    or command:match "^윈도 (.+)$"
  if windowCommand then
    action = startsWithAlias(windowCommand, windowActions)
    if action then
      return { kind = "action", name = action, params = {} }
    end
  end

  local displayCommand = command:match "^display (.+)$"
    or command:match "^디스플레이 (.+)$"
  if displayCommand then
    action = startsWithAlias(displayCommand, displayActions)
    if action then
      return { kind = "action", name = action, params = {} }
    end
  end

  return { kind = "paste", text = processedText }
end

local function dispatch(rawText, processedText, onComplete)
  local result = M.classify(rawText, processedText)
  hs.timer.doAfter(0.05, function()
    local ok, err = xpcall(function()
      if result.kind == "paste" then
        dependencies.pasteText(result.text)
        return
      end

      local action = dependencies.voiceActions[result.name]
      if not action then
        dependencies.alert("Unknown voice action: " .. tostring(result.name))
        return
      end

      action(result.params)
    end, debug.traceback)
    if not ok then
      dependencies.alert("Whisper Voice action failed")
      hs.printf("Whisper Voice dispatch failed: %s", err)
    end

    local completionDelay = result.kind == "action" and 0.5 or 0.05
    hs.timer.doAfter(completionDelay, onComplete)
  end)
end

local processNextNormalization

local function finishProcessing()
  normalizationTask = nil
  processing = false
  processNextNormalization()
end

processNextNormalization = function()
  if processing or #normalizationQueue == 0 then
    return
  end

  processing = true
  local payload = table.remove(normalizationQueue, 1)
  normalizationTask = hs.task.new(
    "/usr/bin/iconv",
    function(exitCode, stdOut, stdErr)
      if exitCode ~= 0 then
        dependencies.alert("Unable to normalize Whisper Voice text")
        hs.printf("Whisper Voice iconv failed: %s", stdErr)
        finishProcessing()
        return
      end

      local separator = stdOut:find("\0", 1, true)
      if not separator then
        dependencies.alert("Invalid Whisper Voice payload")
        finishProcessing()
        return
      end

      dispatch(
        stdOut:sub(1, separator - 1),
        stdOut:sub(separator + 1),
        finishProcessing
      )
    end,
    { "-f", "UTF-8-MAC", "-t", "UTF-8" }
  )
  if not normalizationTask then
    dependencies.alert("Unable to create Whisper Voice normalization task")
    finishProcessing()
    return
  end

  normalizationTask:setInput(payload)
  if not normalizationTask:start() then
    dependencies.alert("Unable to start Whisper Voice normalization task")
    finishProcessing()
  end
end

local function enqueueNormalization(payload)
  table.insert(normalizationQueue, payload)
  processNextNormalization()
end

local function readRequest(token)
  if type(token) ~= "string" or not token:match "^request%.[%w]+$" then
    return
  end

  local path = inbox .. token
  if hs.fs.symlinkAttributes(path, "mode") == "link" then
    return
  end

  local attributes = hs.fs.attributes(path)
  if not attributes or attributes.mode ~= "file" or attributes.size > 2 * 1024 * 1024 then
    return
  end

  local file = io.open(path, "rb")
  if not file then
    return
  end

  local payload = file:read "*a"
  file:close()
  os.remove(path)
  return payload
end

function M.start(values)
  dependencies = values
  hs.urlevent.bind("whisper-voice", function(_, params)
    local payload = readRequest(params.request)
    if payload then
      enqueueNormalization(payload)
    end
  end)
end

return M
