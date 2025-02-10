local M = {}

function M.setup()
  local function paste_image_to_markdown()
    -- 현재 열려 있는 파일(버퍼)의 디렉터리 경로
    local current_file_dir = vim.fn.expand '%:p:h'
    if current_file_dir == '' then
      -- 아직 파일이 저장되지 않았거나, 버퍼가 임시인 경우
      -- 원하는 fallback 동작을 넣거나 에러 메시지를 띄울 수도 있음
      print '현재 버퍼가 실제 파일로 저장되지 않았습니다.'
      return
    end

    --  클립보드에 이미지가 있는지 먼저 확인 (임시 파일에 붙여넣기)
    local tmp_file = '/tmp/tmp_nvim_clipboard.png'
    -- 혹시 이전에 남아있을 수도 있으니 삭제
    os.remove(tmp_file)

    -- pngpaste로 클립보드 내용을 임시 파일에 붙여넣기
    local result = os.execute(string.format("pngpaste '%s'", tmp_file))
    if result ~= 0 then
      print 'pngpaste 명령 실행에 실패했습니다. 클립보드에 이미지가 있는지 확인하세요.'
      return
    end

    -- vim.v.shell_error: 이전 system() 명령의 종료 코드.
    -- 0이 아니면 에러 => 즉, 이미지가 없거나 변환 불가
    if vim.v.shell_error ~= 0 then
      print '클립보드에 이미지가 없거나 변환할 수 없습니다.'
      return
    end

    -- 현재 파일이 위치한 폴더 내부에 'assets' 폴더 만들기
    local assets_dir = current_file_dir .. '/assets'
    vim.fn.mkdir(assets_dir, 'p') -- "p" 옵션: 하위 디렉터리까지 생성

    -- 이미지 파일 이름 (ex: image-20250108-130000.png)
    local img_name = os.date 'image-%Y%m%d-%H%M%S.png'
    local img_path = assets_dir .. '/' .. img_name

    -- macOS 기준 pngpaste 명령어로 클립보드 이미지를 저장
    -- (Linux라면 xclip -selection clipboard -t image/png -o > img_path 등으로 대체)
    os.execute(string.format("pngpaste '%s'", img_path))

    -- 마크다운 문서에 삽입할 링크 (상대 경로로 넣고 싶다면 아래와 같이)
    local rel_path = 'assets/' .. img_name
    local markdown_link = string.format('![%s](%s)', img_name, rel_path)

    if markdown_link == nil or markdown_link == '' then
      print 'Markdown 링크가 비어 있습니다. 이미지가 정상적으로 저장되지 않았을 수 있습니다.'
      return
    end

    -- 링크를 현재 커서 위치에 삽입
    vim.api.nvim_put({ markdown_link }, 'c', true, true)
  end

  -- :PasteLocalImage 명령 생성
  vim.api.nvim_create_user_command(
    'PasteLocalImage',
    paste_image_to_markdown,
    {}
  )

  -- NORMAL, VISUAL 모드에서 <leader>ip 눌렀을 때 PasteLocalImage 실행
  -- vim.api.nvim_set_keymap("v", "<leader>ip", ":PasteLocalImage<CR>", { noremap = true, silent = true })
  -- vim.api.nvim_set_keymap("n", "<leader>ip", ":PasteLocalImage<CR>", { noremap = true, silent = true })

  vim.api.nvim_create_autocmd('FileType', {
    pattern = 'markdown',
    callback = function(args)
      -- args.buf => 현재 버퍼 번호
      vim.keymap.set('n', '<leader>ip', ':PasteLocalImage<CR>', {
        buffer = args.buf, -- 해당 버퍼에만 적용(버퍼 로컬 키맵)
        desc = 'Paste image (pngpaste) in markdown',
      })

      vim.keymap.set('v', '<leader>ip', ':PasteLocalImage<CR>', {
        buffer = args.buf, -- 해당 버퍼에만 적용(버퍼 로컬 키맵)
        desc = 'Paste image (pngpaste) in markdown',
      })
    end,
  })
end

return M
