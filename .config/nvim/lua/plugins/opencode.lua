return {
  config = function()
    vim.g.opencode_opts = {
      provider = {
        enabled = 'snacks',
        snacks = {
          win = {
            position = 'left',
            width = 0.4,
          },
        },
        terminal = {
          split = 'left',
          width = math.floor(vim.o.columns * 0.40),
        },
        wezterm = {
          direction = 'left',
          top_level = true,
          percent = 35,
        },
      },
      ask = {
        blink_cmp_sources = { 'opencode', 'buffer', 'path' },
      },
      contexts = {
        ['@diff-all'] = function()
          local handle = io.popen 'git --no-pager diff HEAD'
          if not handle then
            return nil
          end
          local result = handle:read '*a'
          handle:close()
          if result and result ~= '' then
            return result
          end
          return nil
        end,
      },
      prompts = {
        ask_this = { prompt = '@this: ', ask = true, submit = true },
        diagnostics = { prompt = '@diagnostics를 설명해줘', submit = true },
        diff = { prompt = '다음 git diff를 정확성과 가독성 측면에서 리뷰해줘: @diff', submit = true },
        diff_all = {
          prompt = '다음 모든 변경사항(staged + unstaged)을 정확성과 가독성 측면에서 리뷰해줘: @diff-all',
          submit = true,
        },
        document = { prompt = '@this에 주석을 추가해서 문서화해줘', submit = true },
        explain = { prompt = '@this와 그 컨텍스트를 설명해줘', submit = true },
        fix = { prompt = '@diagnostics를 수정해줘', submit = true },
        implement = { prompt = '@this를 구현해줘', submit = true },
        optimize = { prompt = '@this를 성능과 가독성 측면에서 최적화해줘', submit = true },
        review = { prompt = '@this를 정확성과 가독성 측면에서 리뷰해줘', submit = true },
        test = { prompt = '@this에 대한 테스트를 추가해줘', submit = true },
      },
      select = {
        sections = {
          commands = {
            ['session.new'] = '새로운 세션 생성',
            ['session.share'] = '세션 공유',
            ['session.interrupt'] = '세션 중단',
            ['session.compact'] = '세션 압축',
            ['session.undo'] = '마지막 작업 취소',
            ['session.redo'] = '마지막 취소 작업 재실행',
            ['agent.cycle'] = '선택된 에이전트 순환',
          },
        },
      },
    }

    vim.o.autoread = true
  end,
}
