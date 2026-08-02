require("hs.ipc")
hs.autoLaunch(true)

local currentApplication
local lastOperation
local pendingApplicationActivation
local pasteState = {
  expectedChangeCount = nil,
  generation = 0,
  originalData = nil,
  timer = nil,
}
local ignoredApplications = {
  ["org.hammerspoon.Hammerspoon"] = true,
}
local displays = {
  [1] = "761D8E0F-2B5C-4713-A6CB-D7EC6DB6C0A5",
  [2] = "CC73A19F-7293-49FF-8C00-B30DA0D43C45",
}

local function isIgnoredApplication(bundleID)
  return not bundleID or ignoredApplications[bundleID] == true
end

local function screenByUUID(uuid)
  for _, screen in ipairs(hs.screen.allScreens()) do
    if screen:getUUID() == uuid then
      return screen
    end
  end
end

local function openChromeProfile(profileDirectory, url)
  local arguments = {
    "-na",
    "Google Chrome",
    "--args",
    "--profile-directory=" .. profileDirectory,
    url,
  }

  hs.task.new("/usr/bin/open", nil, arguments):start()
end

local function snapshotWindow(window)
  local screen = window:screen()
  local application = window:application()
  local windowID = window:id()
  if not screen or not application or not windowID then
    return
  end

  local frame = window:frame()
  local screenFrame = screen:frame()
  return {
    kind = "window",
    windowID = windowID,
    unit = {
      x = (frame.x - screenFrame.x) / screenFrame.w,
      y = (frame.y - screenFrame.y) / screenFrame.h,
      w = frame.w / screenFrame.w,
      h = frame.h / screenFrame.h,
    },
    screenUUID = screen:getUUID(),
    minimized = window:isMinimized(),
    applicationBundleID = application:bundleID(),
  }
end

local function rememberWindow(window)
  local snapshot = snapshotWindow(window)
  if not snapshot then
    hs.alert.show("Unable to read window state")
    return false
  end

  lastOperation = snapshot
  return true
end

local function restoreApplication(operation)
  if operation.bundleID == currentApplication then
    hs.alert.show("Application is already active")
    return
  end

  local application = hs.application.get(operation.bundleID)
  if not application then
    hs.alert.show("Previous application is no longer running")
    lastOperation = nil
    return
  end

  lastOperation = currentApplication and {
    kind = "application",
    bundleID = currentApplication,
  } or nil
  pendingApplicationActivation = {
    bundleID = operation.bundleID,
    expiresAt = hs.timer.secondsSinceEpoch() + 1,
  }
  application:activate()
end

local function restoreWindow(operation)
  local window = hs.window.get(operation.windowID)
  if not window then
    hs.alert.show("Previous window is no longer available")
    lastOperation = nil
    return
  end

  local application = window:application()
  if not application or application:bundleID() ~= operation.applicationBundleID then
    hs.alert.show("Previous window identity has changed")
    lastOperation = nil
    return
  end

  local targetScreen = screenByUUID(operation.screenUUID)
  if not targetScreen then
    hs.alert.show("Previous display is not connected")
    return
  end

  local inverse = snapshotWindow(window)
  if not inverse then
    hs.alert.show("Unable to read previous window state")
    return
  end

  local screenFrame = targetScreen:frame()
  local targetFrame = {
    x = screenFrame.x + operation.unit.x * screenFrame.w,
    y = screenFrame.y + operation.unit.y * screenFrame.h,
    w = operation.unit.w * screenFrame.w,
    h = operation.unit.h * screenFrame.h,
  }

  lastOperation = inverse

  if not operation.minimized and operation.applicationBundleID ~= currentApplication then
    pendingApplicationActivation = {
      bundleID = operation.applicationBundleID,
      expiresAt = hs.timer.secondsSinceEpoch() + 1,
    }
  end

  if operation.minimized then
    window:moveToScreen(targetScreen, true, true, 0)
    window:setFrame(targetFrame, 0)
    window:minimize()
    return
  end

  window:unminimize()
  window:moveToScreen(targetScreen, true, true, 0)
  window:setFrame(targetFrame, 0)
  window:focus()
end

local function goBack()
  if not lastOperation then
    hs.alert.show("Nothing to restore")
    return
  end

  local operation = lastOperation
  if operation.kind == "application" then
    restoreApplication(operation)
    return
  end

  restoreWindow(operation)
end

local function focusedApplicationWindow()
  local application = currentApplication and hs.application.get(currentApplication)
  local window = application and application:focusedWindow()

  return window or hs.window.focusedWindow()
end

local function moveFocusedWindow(unit)
  local window = focusedApplicationWindow()
  if not window then
    hs.alert.show("No focused window")
    return
  end

  if not rememberWindow(window) then
    return
  end

  window:moveToUnit(unit, 0)
end

local function minimizeFocusedWindow()
  local window = focusedApplicationWindow()
  if not window then
    hs.alert.show("No focused window")
    return
  end

  if not rememberWindow(window) then
    return
  end

  window:minimize()
end

local function moveFocusedWindowToDisplay(displayNumber)
  local targetUUID = displays[displayNumber]
  local targetScreen = screenByUUID(targetUUID)

  if not targetScreen then
    hs.alert.show("Display " .. displayNumber .. " is not connected")
    return
  end

  local window = focusedApplicationWindow()
  if not window then
    hs.alert.show("No focused window")
    return
  end

  if not rememberWindow(window) then
    return
  end

  window:moveToScreen(targetScreen, false, true, 0)
end

local function restorePasteboard(data)
  hs.pasteboard.clearContents()

  local add = false
  local success = true
  for uti, value in pairs(data or {}) do
    success = hs.pasteboard.writeDataForUTI(uti, value, add) and success
    add = true
  end

  return success
end

local function resetPasteState()
  if pasteState.timer then
    pasteState.timer:stop()
  end

  pasteState.expectedChangeCount = nil
  pasteState.originalData = nil
  pasteState.timer = nil
end

local function pasteboardItemCount()
  local ok, count = hs.osascript.javascript [[
    ObjC.import("AppKit");
    $.NSPasteboard.generalPasteboard.pasteboardItems.js.length;
  ]]

  return ok and tonumber(count) or 2
end

local function pasteText(text)
  if pasteboardItemCount() > 1 then
    resetPasteState()
    hs.eventtap.keyStrokes(text)
    return
  end

  local currentChangeCount = hs.pasteboard.changeCount()
  if pasteState.originalData and currentChangeCount ~= pasteState.expectedChangeCount then
    resetPasteState()
  end

  if not pasteState.originalData then
    pasteState.originalData = hs.pasteboard.readAllData() or {}
  end

  if not hs.pasteboard.setContents(text) then
    if pasteState.originalData
      and hs.pasteboard.changeCount() == pasteState.expectedChangeCount
    then
      restorePasteboard(pasteState.originalData)
    end
    resetPasteState()
    hs.alert.show("Unable to prepare dictated text")
    return
  end

  if pasteState.timer then
    pasteState.timer:stop()
  end

  pasteState.generation = pasteState.generation + 1
  local generation = pasteState.generation
  pasteState.expectedChangeCount = hs.pasteboard.changeCount()
  hs.eventtap.keyStroke({ "cmd" }, "v", 0)

  pasteState.timer = hs.timer.doAfter(0.4, function()
    if generation ~= pasteState.generation then
      return
    end

    if hs.pasteboard.changeCount() == pasteState.expectedChangeCount then
      local restored = restorePasteboard(pasteState.originalData)
        or restorePasteboard(pasteState.originalData)
      if not restored then
        pasteState.expectedChangeCount = hs.pasteboard.changeCount()
        pasteState.timer = nil
        hs.alert.show("Unable to restore clipboard completely")
        return
      end
    end

    resetPasteState()
  end)
end

hs.shutdownCallback = function()
  if pasteState.originalData
    and hs.pasteboard.changeCount() == pasteState.expectedChangeCount
  then
    restorePasteboard(pasteState.originalData)
  end
end

local voiceActions = {
  focusBrowser = function()
    openChromeProfile("Profile 2", "chrome://newtab")
  end,
  focusTerminal = function()
    hs.application.launchOrFocus("WezTerm")
  end,
  focusNotes = function()
    hs.application.launchOrFocus("Notes")
  end,
  goBack = goBack,
  searchGoogle = function(params)
    local query = params.query
    if not query or query == "" then
      hs.alert.show("Search query is empty")
      return
    end

    openChromeProfile(
      "Profile 2",
      "https://www.google.com/search?q=" .. hs.http.encodeForQuery(query)
    )
  end,
  openYouTube = function()
    openChromeProfile("Profile 8", "https://www.youtube.com")
  end,
  openNetflix = function()
    openChromeProfile("Profile 2", "https://www.netflix.com")
  end,
  windowLeft = function()
    moveFocusedWindow({ x = 0, y = 0, w = 0.5, h = 1 })
  end,
  windowRight = function()
    moveFocusedWindow({ x = 0.5, y = 0, w = 0.5, h = 1 })
  end,
  windowUp = function()
    moveFocusedWindow({ x = 0, y = 0, w = 1, h = 0.5 })
  end,
  windowDown = function()
    moveFocusedWindow({ x = 0, y = 0.5, w = 1, h = 0.5 })
  end,
  windowFull = function()
    moveFocusedWindow({ x = 0, y = 0, w = 1, h = 1 })
  end,
  windowMinimize = minimizeFocusedWindow,
  display1 = function()
    moveFocusedWindowToDisplay(1)
  end,
  display2 = function()
    moveFocusedWindowToDisplay(2)
  end,
}

local routerPath = os.getenv("HOME") .. "/.config/whisper-voice/router.lua"
local routerStarted, routerError = xpcall(function()
  local whisperVoiceRouter = dofile(routerPath)
  assert(type(whisperVoiceRouter) == "table", "router module must return a table")
  assert(type(whisperVoiceRouter.start) == "function", "router.start must be a function")
  whisperVoiceRouter.start({
    voiceActions = voiceActions,
    pasteText = pasteText,
    alert = hs.alert.show,
  })
end, debug.traceback)
if not routerStarted then
  hs.alert.show("Unable to load Whisper Voice router")
  hs.printf("Whisper Voice router load failed: %s", routerError)
end

applicationWatcher = hs.application.watcher.new(function(_, event, application)
  if event ~= hs.application.watcher.activated or not application then
    return
  end

  local bundleID = application:bundleID()
  if isIgnoredApplication(bundleID) then
    return
  end

  if bundleID == currentApplication then
    return
  end

  local now = hs.timer.secondsSinceEpoch()
  local previousApplication = currentApplication
  currentApplication = bundleID

  if pendingApplicationActivation and now > pendingApplicationActivation.expiresAt then
    pendingApplicationActivation = nil
  end

  if pendingApplicationActivation and bundleID == pendingApplicationActivation.bundleID then
    pendingApplicationActivation = nil
    return
  end

  pendingApplicationActivation = nil

  if previousApplication then
    lastOperation = {
      kind = "application",
      bundleID = previousApplication,
    }
  end
end)

local frontmostApplication = hs.application.frontmostApplication()
if frontmostApplication and not isIgnoredApplication(frontmostApplication:bundleID()) then
  currentApplication = frontmostApplication:bundleID()
end

applicationWatcher:start()
