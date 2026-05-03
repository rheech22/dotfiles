import OpenAI from "openai"
import { appendFile } from "fs/promises"
import { API_KEY, LOG_DIR, MODEL } from "./config"
import { writeTrace } from "./logger"
import { tracer, type TraceRun } from "./tracing"
import type { ExistingDoc, SummaryPayload } from "./types"
import { withRetry } from "./utils"

const llmClient = new OpenAI({ apiKey: API_KEY, baseURL: "https://api.synthetic.new/openai/v1" })

export function hasApiKey(): boolean {
  return Boolean(API_KEY)
}

type SkipPayload = { action: "skip"; reason?: string }
type LlmPayload = SummaryPayload | SkipPayload
type ParseResult = { payload: LlmPayload | null; mode: string; error?: string }

const RESPONSE_SCHEMA = {
  name: "dev_log_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["overwrite", "new", "skip"] },
      targetPath: { type: "string" },
      title: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      markdown: { type: "string" },
      reason: { type: "string" },
    },
    required: ["action"],
    additionalProperties: false,
  },
} as const

function isSkipPayload(payload: LlmPayload): payload is SkipPayload {
  return payload.action === "skip"
}

function isSummaryPayload(payload: LlmPayload): payload is SummaryPayload {
  if (payload.action !== "new" && payload.action !== "overwrite") return false
  if (typeof payload.title !== "string" || payload.title.trim().length === 0) return false
  if (typeof payload.markdown !== "string" || payload.markdown.trim().length === 0) return false
  if (!Array.isArray(payload.tags)) return false
  if (!payload.tags.every((tag) => typeof tag === "string")) return false
  return true
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("```")) return raw
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

function extractTitleFromMarkdown(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const heading = lines.find((line) => line.startsWith("# ") || line.startsWith("## "))
  if (heading) return heading.replace(/^#{1,2}\s+/, "").slice(0, 80)
  return (lines[0] ?? "session").slice(0, 80)
}

function looksLikeBrokenJson(raw: string): boolean {
  const trimmed = raw.trim()
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false
  const openCurly = (trimmed.match(/\{/g) ?? []).length
  const closeCurly = (trimmed.match(/\}/g) ?? []).length
  const openSquare = (trimmed.match(/\[/g) ?? []).length
  const closeSquare = (trimmed.match(/\]/g) ?? []).length
  return openCurly !== closeCurly || openSquare !== closeSquare
}

function buildTemplateFallback(raw: string): SummaryPayload {
  const snippet = raw.slice(0, 1200).trim()
  return {
    action: "new",
    targetPath: "",
    title: "Session Note (parse failed)",
    tags: ["needs-review"],
    markdown: `LLM 출력 파싱에 실패해 최소 문서로 저장했습니다. 검토 후 정리하거나 삭제하세요.\n\nRaw snippet:\n\n\`\`\`text\n${snippet}\n\`\`\``,
  }
}

function parseLlmPayload(raw: string): ParseResult {
  try {
    return { payload: JSON.parse(raw) as LlmPayload, mode: "json" }
  } catch (error) {
    const fenced = stripCodeFence(raw)
    if (fenced !== raw) {
      try {
        return { payload: JSON.parse(fenced) as LlmPayload, mode: "fenced-json" }
      } catch {
        // continue
      }
    }
    const extracted = extractJsonObject(raw)
    if (extracted) {
      try {
        return { payload: JSON.parse(extracted) as LlmPayload, mode: "sliced-json" }
      } catch {
        // continue
      }
    }
    const message = error instanceof Error ? error.message : "unknown"
    return { payload: null, mode: "parse-failed", error: message }
  }
}

function normalizeSummary(summary: SummaryPayload): SummaryPayload {
  const tags = Array.from(new Set(summary.tags.map((tag) => tag.trim()).filter(Boolean)))
  return {
    ...summary,
    title: summary.title.trim(),
    tags,
    markdown: summary.markdown.trim(),
  }
}

function countParagraphs(markdown: string): number {
  return markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => {
      if (!chunk) return false
      if (/^#{1,6}\s/.test(chunk)) return false
      if (/^[-*]\s/.test(chunk)) return false
      if (/^\|/.test(chunk)) return false
      if (/^```/.test(chunk)) return false
      return true
    }).length
}

function countWords(markdown: string): number {
  const normalized = markdown.replace(/\s+/g, " ").trim()
  if (!normalized) return 0
  return normalized.split(" ").length
}

function assessProseQuality(markdown: string): {
  pass: boolean
  reason: string
  ratio: number
  headingLines: number
  paragraphs: number
  wordCount: number
} {
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    return { pass: false, reason: "empty", ratio: 1, headingLines: 0, paragraphs: 0, wordCount: 0 }
  }

  const headingLines = lines.filter((line) => /^#{1,6}\s/.test(line)).length
  const bulletLines = lines.filter((line) => /^[-*]\s/.test(line)).length
  const ratio = (headingLines + bulletLines) / lines.length
  const paragraphs = countParagraphs(markdown)
  const wordCount = countWords(markdown)

  if (ratio > 0.55) {
    return { pass: false, reason: "too-listy", ratio, headingLines, paragraphs, wordCount }
  }
  if (headingLines > 5) {
    return { pass: false, reason: "too-many-headings", ratio, headingLines, paragraphs, wordCount }
  }
  if (wordCount >= 200 && paragraphs < 2) {
    return { pass: false, reason: "too-few-paragraphs", ratio, headingLines, paragraphs, wordCount }
  }
  return { pass: true, reason: "ok", ratio, headingLines, paragraphs, wordCount }
}

async function writeRawResponseLog(raw: string): Promise<void> {
  const ts = new Date().toISOString()
  const entry = [`\n===== LLM RAW RESPONSE ${ts} =====`, raw, "===== END =====\n"].join("\n")
  const outPath = `${LOG_DIR}/dev-log.llm-raw.log`
  await appendFile(outPath, entry, "utf-8")
}

export async function summarizeSession(input: {
  today: string
  transcript: string
  existingDocs: ExistingDoc[]
}, traceParent?: TraceRun): Promise<SummaryPayload | null> {
  const llmTrace = await tracer.startRun(
    "dev-log.llm.summarize",
    "chain",
    {
      today: input.today,
      transcript: input.transcript,
      existingDocs: input.existingDocs,
    },
    traceParent,
  )

  let finalSummary: SummaryPayload | null = null
  let traceError: string | undefined

  try {
  const systemPrompt = `당신은 개발자의 코딩 세션을 분석해 학습 로그를 작성하는 AI입니다.
한국어로 작성하고 1500단어 이내로 유지하세요.
1500단어는 상한이며 목표 분량이 아닙니다. 의미 있는 내용이 짧으면 짧게 끝내세요.
분량을 채우기 위해 자명한 사실이나 원론적인 설명을 덧붙이지 마세요.

# 핵심 원칙
"미래의 나에게 도움이 될 것만 남긴다"
유의미한 내용이 없다면 억지로 만들지 말고 skip 하세요.

# 남겨야 할 내용
- 새로 알게 된 사실
- 문제/원인/해결이 명확한 트러블슈팅
- 왜 그렇게 동작하는지에 대한 원리(Why)
- 다음에 피해야 할 함정(gotcha)
- 근거 있는 트레이드오프
- 재사용 가능한 패턴

# 남기지 말아야 할 내용
- 기계적 작업(생성/이름변경/설치 등)
- 인사이트 없는 단순 정리/포맷팅
- 기존 로그와 중복되고 추가 학습이 없는 내용
- 미완결 탐색, 단발성 잡음

반드시 아래 JSON만 출력하세요(설명/코드블록/주석 금지):
남길 내용이 있으면:
{"action":"overwrite|new","targetPath":"","title":"","tags":[],"markdown":""}
남길 내용이 없으면:
{"action":"skip","reason":"<짧은 사유>"}

규칙:
- 위 제외 기준에 해당하거나 기록 가치가 낮으면 action=skip
- 기존 로그 후보 중 같은 주제가 있으면 action=overwrite
- 없으면 action=new
- targetPath는 항상 빈 문자열("")로 두세요. 경로는 시스템이 결정합니다.
- 기존 로그가 있고 새 대화에 의미 있는 추가 정보가 없으면 action=skip
- 기존 로그를 더 정확하게 다듬을 새 사실이 있으면 skip 대신 overwrite
- 대화가 짧아도 중요한 함정/결정이 있으면 분량과 무관하게 기록
- markdown에 최종 문서를 넣으세요.
- markdown 본문은 frontmatter를 포함하지 마세요.
- markdown 본문은 H1 없이 시작하고, 첫 단락에서 핵심 맥락을 설명하세요.

작성 구조:
- 첫 단락 또는 마지막 단락 중 한 곳에 이번 세션의 구체적 맥락(어떤 작업/코드/도구/에러)을 1~2문장으로 반드시 남기세요.
- 인사이트만 있는 추상적 에세이가 되지 않게 하세요.

작성 스타일:
- prose-first: 기본은 문단(paragraph)으로 작성합니다.
- 헤딩은 정말 필요한 구획에서만 사용하고, 과도한 소제목 나열을 피하세요.
- Why/근거/맥락은 리스트보다 문장으로 풀어서 설명하세요.

title / tags 가이드:
- title은 본문 핵심을 한 줄로 압축하고 구체 키워드를 포함하세요.
- "~에 대하여" 같은 모호한 제목은 피하세요.
- tags는 2~5개, 기술 스택/도구/개념 중심으로 작성하세요.
- 너무 일반적인 태그(예: 개발, 코딩)는 피하세요.

markdown 코드블록 정책:
- 코드블록은 필요할 때만 선택적으로 허용
- 최대 1개, 12줄 이하
- 핵심 변경/핵심 패턴만 포함
- 비밀값/토큰/민감정보는 마스킹`

  const userMessage = `기존 로그 후보(JSON):\n${JSON.stringify(input.existingDocs)}\n\n최신 세션 대화:\n${input.transcript}`

  const createPayload = (retryForJsonOnly: boolean, temperature: number) => ({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "system" as const,
        content: retryForJsonOnly
          ? `${systemPrompt}\n\n이전 응답 형식이 스키마를 벗어났습니다. 반드시 스키마에 맞는 JSON 객체 하나만 출력하세요.`
          : systemPrompt,
      },
      { role: "user" as const, content: userMessage },
    ],
    temperature,
    response_format: {
      type: "json_schema" as const,
      json_schema: RESPONSE_SCHEMA,
    },
  })

  async function requestSummary(
    phase: string,
    retryForJsonOnly: boolean,
    temperature: number,
    modeOverride?: "json-schema" | "json-object",
  ): Promise<{ raw: string; mode: "json-schema" | "json-object"; finishReason: string }> {
    const reqTrace = await tracer.startRun(
      `dev-log.llm.${phase}`,
      "llm",
      {
        retryForJsonOnly,
        temperature,
        modeOverride: modeOverride ?? "json-schema",
        systemPrompt,
        userMessage,
      },
      llmTrace ?? undefined,
    )

    if (modeOverride === "json-object") {
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          ...createPayload(retryForJsonOnly, temperature),
          response_format: { type: "json_object" as const },
        }),
      )
      const outputs: { raw: string; mode: "json-object"; finishReason: string } = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-object",
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(reqTrace, { outputs })
      return {
        raw: outputs.raw,
        mode: outputs.mode,
        finishReason: outputs.finishReason,
      }
    }

    try {
      const response = await withRetry(() => llmClient.chat.completions.create(createPayload(retryForJsonOnly, temperature)))
      const outputs: { raw: string; mode: "json-schema"; finishReason: string } = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-schema",
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(reqTrace, { outputs })
      return {
        raw: outputs.raw,
        mode: outputs.mode,
        finishReason: outputs.finishReason,
      }
    } catch (error) {
      await writeTrace(`llm structured schema failed err=${error instanceof Error ? error.message : "unknown"}`)
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          ...createPayload(retryForJsonOnly, temperature),
          response_format: { type: "json_object" as const },
        }),
      )
      const outputs: { raw: string; mode: "json-object"; finishReason: string } = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-object",
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(reqTrace, {
        outputs,
        extra: { structuredFallback: true },
      })
      return {
        raw: outputs.raw,
        mode: outputs.mode,
        finishReason: outputs.finishReason,
      }
    }
  }

  async function requestRewrite(
    rewriteInstruction: string,
    mode: "json-schema" | "json-object",
  ): Promise<{ raw: string; mode: "json-schema" | "json-object"; finishReason: string }> {
    const rewriteTrace = await tracer.startRun(
      "dev-log.llm.rewrite",
      "llm",
      { rewriteInstruction, mode },
      llmTrace ?? undefined,
    )

    if (mode === "json-object") {
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          model: MODEL,
          max_tokens: 4096,
          messages: [{ role: "user", content: rewriteInstruction }],
          temperature: 0.2,
          response_format: { type: "json_object" as const },
        }),
      )
      const outputs: { raw: string; mode: "json-object"; finishReason: string } = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-object",
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(rewriteTrace, { outputs })
      return {
        raw: outputs.raw,
        mode: outputs.mode,
        finishReason: outputs.finishReason,
      }
    }

    const response = await withRetry(() =>
      llmClient.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: rewriteInstruction }],
        temperature: 0.2,
        response_format: { type: "json_schema" as const, json_schema: RESPONSE_SCHEMA },
      }),
    )

    const outputs: { raw: string; mode: "json-schema"; finishReason: string } = {
      raw: response.choices[0]?.message?.content ?? "",
      mode: "json-schema",
      finishReason: response.choices[0]?.finish_reason ?? "unknown",
    }
    await tracer.endRun(rewriteTrace, { outputs })

    return {
      raw: outputs.raw,
      mode: outputs.mode,
      finishReason: outputs.finishReason,
    }
  }

  const first = await requestSummary("primary", false, 0.35)
  const raw = first.raw
  const structuredMode = first.mode
  await writeTrace(`llm finish_reason=${first.finishReason} mode=${first.mode}`)

  if (!raw) return null
  await writeRawResponseLog(raw)
  await writeTrace(`llm raw len=${raw.length} preview=${raw.slice(0, 500).replace(/\n/g, " ")}`)

  const parsed = parseLlmPayload(raw)
  if (!parsed.payload) {
    await writeTrace(
      `llm parse failed mode=${parsed.mode} err=${parsed.error ?? "unknown"} len=${raw.length} raw=${raw.slice(0, 220).replace(/\n/g, " ")}`,
    )
    const retry = await requestSummary("retry", true, 0.2, structuredMode)
    await writeTrace(`llm finish_reason=${retry.finishReason} mode=${retry.mode} (retry)`)
    if (retry.raw) {
      await writeRawResponseLog(retry.raw)
      const retryParsed = parseLlmPayload(retry.raw)
      if (retryParsed.payload) {
        await writeTrace(`llm parsed mode=${retryParsed.mode} (retry)`)
        if (isSkipPayload(retryParsed.payload)) {
          await writeTrace(`llm skip reason=${retryParsed.payload.reason ?? "no-reason"}`)
          return null
        }
        if (isSummaryPayload(retryParsed.payload)) {
          const normalizedRetry = normalizeSummary(retryParsed.payload)
          const retryQuality = assessProseQuality(normalizedRetry.markdown)
          await writeTrace(
            `quality_gate=${retryQuality.pass ? "pass" : "fail"} reason=${retryQuality.reason} ratio=${retryQuality.ratio.toFixed(2)} headings=${retryQuality.headingLines} paragraphs=${retryQuality.paragraphs} words=${retryQuality.wordCount} phase=retry`,
          )
          if (retryQuality.pass) {
            finalSummary = normalizedRetry
            return normalizedRetry
          }
        }
      }
    }

    const markdownFallback = stripCodeFence(raw).trim()
    if (!markdownFallback) {
      finalSummary = buildTemplateFallback(raw)
      return finalSummary
    }
    if (looksLikeBrokenJson(markdownFallback)) {
      await writeTrace("llm fallback blocked: broken-json-like output")
      finalSummary = buildTemplateFallback(raw)
      return finalSummary
    }
    await writeTrace(`llm fallback markdown len=${markdownFallback.length}`)
    finalSummary = {
      action: "new",
      targetPath: "",
      title: extractTitleFromMarkdown(markdownFallback),
      tags: ["needs-review"],
      markdown: markdownFallback,
    }
    return finalSummary
  }

  const payload = parsed.payload
  await writeTrace(`llm parsed mode=${parsed.mode}`)

  if (isSkipPayload(payload)) {
    await writeTrace(`llm skip reason=${payload.reason ?? "no-reason"}`)
    return null
  }

  if (!isSummaryPayload(payload)) {
    await writeTrace("llm validation failed: invalid summary payload")
    return null
  }

  const normalized = normalizeSummary(payload)
  const quality = assessProseQuality(normalized.markdown)
  await writeTrace(
    `quality_gate=${quality.pass ? "pass" : "fail"} reason=${quality.reason} ratio=${quality.ratio.toFixed(2)} headings=${quality.headingLines} paragraphs=${quality.paragraphs} words=${quality.wordCount} phase=initial`,
  )
  if (quality.pass) {
    finalSummary = normalized
    return normalized
  }

  const rewritePrompt = `다음 markdown은 정보는 맞지만 구조가 리스트/헤딩 위주라 읽기 흐름이 떨어집니다.
사실 추가/삭제/변형 없이 구조만 prose-first로 재작성하세요.

요구사항:
- 본문은 H1 없이 시작
- 기본은 단락 중심
- 필요 없는 헤딩/불릿/표를 줄이기
- 핵심 의미와 근거는 유지

절대 금지:
- 새 정보 추가
- 기존 정보 삭제
- 사실 변형
- title 변경
- tags 변경

허용:
- 단락 재구성
- 헤딩/불릿의 산문 변환
- 같은 의미의 더 자연스러운 표현

반드시 JSON 객체 하나만 출력:
{"action":"overwrite|new","targetPath":"","title":"","tags":[],"markdown":""}

원본 JSON:
${JSON.stringify(normalized)}`

  try {
    const rewrite = await requestRewrite(rewritePrompt, structuredMode)
    await writeTrace(`llm finish_reason=${rewrite.finishReason} mode=${rewrite.mode} (rewrite)`)
    if (rewrite.raw) {
      await writeRawResponseLog(rewrite.raw)
      const rewriteParsed = parseLlmPayload(rewrite.raw)
      if (rewriteParsed.payload && !isSkipPayload(rewriteParsed.payload) && isSummaryPayload(rewriteParsed.payload)) {
        const rewritten = normalizeSummary(rewriteParsed.payload)
        const rewrittenQuality = assessProseQuality(rewritten.markdown)
        await writeTrace(
          `quality_gate=${rewrittenQuality.pass ? "pass" : "fail"} reason=${rewrittenQuality.reason} ratio=${rewrittenQuality.ratio.toFixed(2)} headings=${rewrittenQuality.headingLines} paragraphs=${rewrittenQuality.paragraphs} words=${rewrittenQuality.wordCount} phase=rewrite`,
        )
        if (rewrittenQuality.pass) {
          finalSummary = rewritten
          return rewritten
        }
      }
    }
  } catch (error) {
    await writeTrace(`llm rewrite failed err=${error instanceof Error ? error.message : "unknown"}`)
  }

  await writeTrace("llm rewrite failed: keeping initial summary")
  finalSummary = normalized
  return normalized
  } catch (error) {
    traceError = error instanceof Error ? error.message : "unknown"
    throw error
  } finally {
    await tracer.endRun(llmTrace, {
      outputs: {
        result: finalSummary,
      },
      error: traceError,
    })
  }
}
