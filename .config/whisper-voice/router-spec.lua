local router = dofile(os.getenv("HOME") .. "/.config/whisper-voice/router.lua")

local cases = {
  { "Action Browser", "focusBrowser" },
  { "액션, 터미널.", "focusTerminal" },
  { "Action Notes", "focusNotes" },
  { "액션 유튜브", "openYouTube" },
  { "Action Netflix", "openNetflix" },
  { "Action Back", "goBack" },
  { "ActionBack.", "goBack" },
  { "액션 고백", "goBack" },
  { "액션 윈도우 레프트", "windowLeft" },
  { "Action Window Right", "windowRight" },
  { "액션 윈도우 업", "windowUp" },
  { "Action Window Down", "windowDown" },
  { "액션 윈도우 풀", "windowFull" },
  { "Action Window Minimize", "windowMinimize" },
  { "Action Display One", "display1" },
  { "액션 디스플레이 투", "display2" },
}

for _, case in ipairs(cases) do
  local result = router.classify(case[1], case[1])
  assert(result.kind == "action", case[1] .. " did not produce an action")
  assert(result.name == case[2], case[1] .. " produced " .. tostring(result.name))
end

local search = router.classify("액션 검색 Hammerspoon URL event", "")
assert(search.name == "searchGoogle")
assert(search.params.query == "Hammerspoon URL event")

local fallback = router.classify("일반 받아쓰기", "다듬은 일반 받아쓰기")
assert(fallback.kind == "paste")
assert(fallback.text == "다듬은 일반 받아쓰기")

print("Whisper Voice router tests passed: " .. (#cases + 2))
