# Wiki Forge plugin

opencode 세션을 자동으로 요약해 로컬 Markdown으로 저장하고, Google Drive(`rclone`)로 업로드하는 플러그인입니다.

핵심 목표는 다음 3가지입니다.

- 세션 종료 후 수동 정리 없이 학습 로그를 자동 생성
- 품질 저하/파싱 실패 상황에서도 가능한 한 결과를 보존
- 운영 중 문제를 빠르게 추적할 수 있는 관측성(trace + LangSmith) 확보

## 주요 기능

- `session.idle` 기반 자동 실행
- `message.part.delta` 스트림 기반 메시지 수집 (환경별 `session.messages()` 불안정 대응)
- Structured output 우선(`json_schema` -> `json_object` fallback)
- 품질 게이트(prose-first, 과도한 리스트/헤딩 억제)
- 실패 시 재시도/최소 fallback 문서 생성
- Frontmatter 자동 주입 (`created`, `updated`, `title`, `tags`, `session_id`, `source`)
- `rclone` 업로드 + 실패 시 `.pending` 큐 저장
- 업로드 성공/실패 시스템 알림(알림 실패는 본 로직과 완전 분리)
- LangSmith trace 연동(옵션)

## 디렉터리 구조

```txt
plugin/wiki-forge/
├─ index.ts              # opencode plugin entry wrapper
├─ package.json
├─ tsconfig.json
├─ fixtures/             # transcript fixture와 expectation
├─ scripts/              # 로컬 test runner CLI
└─ src/
   ├─ index.ts           # public API exports
   ├─ plugin.ts          # plugin runtime entry
   ├─ harness.ts         # 고수준 pipeline test API
   ├─ config.ts          # 경로/모델/상수
   ├─ types.ts           # 공용 타입
   ├─ llm/               # 프롬프트/LLM 호출/파싱/리뷰
   ├─ pipeline/          # session 흐름/orchestration/state/transcript
   ├─ storage/           # 저장/업로드/알림
   └─ observability/     # trace/logging
```

## 동작 흐름

1. `message.part.delta` / `message.part.updated`에서 assistant 텍스트를 세션 버퍼에 누적
2. `session.idle` 발생 시 파이프라인 시작
3. transcript 생성 -> LLM 요약 호출
4. 품질 게이트 통과 시 문서 저장, 실패 시 리라이트/ fallback
5. frontmatter 조립 후 `~/wiki-forge/*.md` 저장
6. `rclone copy`로 `gdrive:wiki-forge/` 업로드
7. 업로드 성공/실패 시스템 알림

## 출력 포맷

파일은 아래 frontmatter를 포함합니다.

```yaml
---
created: 2026-05-03 23:07:19 +0900
updated: 2026-05-03 23:07:19 +0900
title: "분산 락에서 얻는 설계 인사이트"
tags: ["분산시스템","동시성","설계패턴"]
session_id: ses_211d
source: opencode
---
```

본문은 H1 없이 prose-first 단락으로 시작합니다.

## 설치/설정

이 디렉터리는 opencode plugin으로 동작하지만, 동시에 독립적인 TypeScript package처럼 다룰 수 있도록 구성할 수 있습니다. 별도 repo로 분리할 가능성이 있다면 `plugin/wiki-forge` 안에서 의존성 설치와 테스트를 직접 돌리는 방식을 권장합니다.

### 1) opencode plugin 등록

`~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["./plugin/wiki-forge/index.ts"]
}
```

### 2) 의존성

`~/.config/opencode/package.json`:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "1.14.33",
    "openai": "4.68.4",
    "langsmith": "0.3.48"
  }
}
```

로컬에서 이 플러그인만 독립적으로 다루려면 `plugin/wiki-forge/package.json` 기준으로도 설치할 수 있습니다.

```bash
cd ~/.config/opencode/plugin/wiki-forge
npm install
```

### 3) 필수 환경변수

- `SYNTHETIC_API_KEY` (LLM 호출용)

### 4) 선택 환경변수 (LangSmith)

- `LANGSMITH_API_KEY`
- `LANGSMITH_PROJECT` (기본값: `wiki-forge`)
- `LANGSMITH_ENDPOINT` (기본값: `https://api.smith.langchain.com`)

`LANGSMITH_API_KEY`가 있으면 tracing이 자동 활성화됩니다.

### 5) rclone

다음 remote/path를 가정합니다.

- remote: `gdrive`
- 대상: `gdrive:wiki-forge/`

## 확장 설계 로드맵 (WIP)

현재 구현은 실사용 안정성에 초점을 둔 단일 기본값 중심 구조입니다. 오픈소스화를 고려하면 아래 항목들을 "주입 가능한 설정"으로 분리하는 것이 좋습니다.

### 1) 업로드 방식 주입

현재: `rclone copy` 고정

확장 목표:

- `upload.strategy = "rclone" | "script" | "none"`
- `script` 모드에서는 사용자 스크립트 경로/인자를 받아 실행
- 업로드 실패 시 공통 `pending` 처리 인터페이스 유지

예시 설정 개념:

```ts
type UploadConfig =
  | { strategy: "rclone"; remote: string; path: string }
  | { strategy: "script"; command: string; args?: string[] }
  | { strategy: "none" }
```

### 2) 다국어 출력 주입

현재: 한국어 고정

확장 목표:

- `language = "ko" | "en" | "ja" ...`
- 프롬프트 템플릿을 언어별 리소스로 분리
- fallback/알림/기본 문구도 동일 언어로 통일

예시 설정 개념:

```ts
type LanguageConfig = {
  language: "ko" | "en"
  tone?: "concise" | "detailed"
}
```

### 3) tracing 백엔드 주입

현재: LangSmith (`RunTree`) 고정

확장 목표:

- `tracing.provider = "langsmith" | "none" | "custom"`
- tracing 어댑터 인터페이스(`startRun`, `endRun`)는 유지
- provider별 payload 정책(전체 본문/샘플/메타만) 분리

예시 설정 개념:

```ts
type TracingConfig = {
  provider: "langsmith" | "none" | "custom"
  includeContent?: "full" | "sample" | "metadata"
}
```

### 4) 프롬프트/품질 게이트 주입

현재: `llm.ts` 내부 상수

확장 목표:

- 시스템 프롬프트 템플릿 외부화(파일/함수)
- 품질 게이트 임계값(`ratio`, `heading`, `wordCount`) 설정화
- 리라이트 on/off, 재시도 횟수 설정화

예시 설정 개념:

```ts
type PromptConfig = {
  maxWords: number
  proseFirst: boolean
  requireSessionAnchor: boolean
}

type QualityGateConfig = {
  maxListRatio: number
  maxHeadings: number
  minParagraphsWhenWordCountAtLeast: number
  rewriteOnFail: boolean
}
```

### 5) LLM provider 주입

현재: OpenAI-compatible + Synthetic endpoint 고정

확장 목표:

- `llm.provider = "synthetic" | "openai" | "anthropic" | "custom"`
- provider별 클라이언트/응답 포맷 차이를 adapter로 캡슐화
- structured output 지원 여부에 따른 전략 분기(JSON schema / parser fallback)

예시 설정 개념:

```ts
type LlmConfig = {
  provider: "synthetic" | "openai" | "anthropic" | "custom"
  model: string
  baseUrl?: string
  apiKeyEnv: string
  maxTokens: number
}
```

### 권장 마이그레이션 순서

1. 설정 타입(`WikiForgeConfig`)과 기본값 레이어 도입
2. `upload` / `tracing`부터 adapter 분리
3. 프롬프트 템플릿 외부화 + 언어 리소스 분리
4. LLM provider adapter 추가
5. 문서/예제 config/마이그레이션 가이드 제공

핵심 원칙은 "파이프라인은 고정, 구현체는 교체 가능"입니다.

## 로그 파일

기본 로그 디렉터리: `~/wiki-forge`

- `wiki-forge.trace.log`: 내부 처리 trace (최근 3000줄 유지)
- `wiki-forge.llm-raw.log`: LLM raw 응답 기록
- `.pending/*.pending`: 업로드 실패 큐

## 로컬 테스트 하니스

`plugin/wiki-forge`는 구현 세부 단계 대신 public API인 `runTranscriptPipeline()`을 기준으로 테스트할 수 있습니다. 테스트 script는 내부 `classifier`, `writer`, `reviewer`를 직접 조합하지 않고 이 API만 호출하므로, 내부 구현이 바뀌어도 fixture와 script 사용법은 유지됩니다.

```bash
cd ~/.config/opencode/plugin/wiki-forge
npm run test:pipeline -- fixtures/example.md --verbose
npm run test:pipeline:batch -- fixtures --save-artifact
```

- transcript fixture: `fixtures/*.md` 또는 `fixtures/*.txt`
- expectation file(optional): `fixtures/*.expect.json`
- artifact는 기본적으로 `artifacts/` 아래에 저장됩니다.

## 안전 장치

- 모델이 반환한 `targetPath`는 신뢰하지 않고 무시
- 저장 경로는 코드가 결정하며 `LOG_DIR` 하위 `.md`만 허용
- 알림 실패는 주 로직에 영향 없음
- LLM 파싱 실패 시 최소 문서 fallback(`needs-review`) 생성

## 운영 팁

- `finish_reason=length`가 잦다면, 프롬프트 길이/`max_tokens`를 함께 조정하세요.
- 품질 게이트 로그(`ratio`, `headings`, `paragraphs`, `words`)를 1~2주 관찰해 임계값을 튜닝하세요.
- `needs-review` 태그 문서만 주기적으로 검토/정리하면 품질 유지에 도움이 됩니다.

## 트러블슈팅

- `session.messages=0`이 반복되면?
  - 이 플러그인은 delta-first 수집을 사용하므로, `message.part.delta` 로그 유입 여부를 먼저 확인하세요.

- LangSmith `dotted_order` 관련 400 에러?
  - `RunTree` 기반 tracing이 적용되어 있어야 합니다. 구버전 코드/다중 인스턴스 혼선을 점검하세요.

- Drive에 의도치 않은 파일이 업로드되면?
  - 최신 코드에서 경로 안전 가드가 작동 중인지(`blocked: unsafe_outPath`) trace를 확인하세요.

## 라이선스 / 공개 준비 메모

오픈소스 공개 전 권장 사항:

- 민감정보 마스킹 정책 문서화
- 설정 가능한 옵션(경로/알림/게이트) env화
- 최소 테스트 케이스(파싱 실패, 업로드 실패, skip, overwrite)
- CHANGELOG/버전 태깅 정책 추가
