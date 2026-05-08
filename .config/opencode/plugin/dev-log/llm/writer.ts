import { MODEL } from "../config"
import { writeTrace } from "../logger"
import { tracer, type TraceRun } from "../tracing"
import type { ExistingDoc, SummaryPayload } from "../types"
import { withRetry } from "../utils"
import { llmClient } from "./client"
import { buildSystemPrompt, buildWriterUserMessage, WRITER_SYSTEM_PROMPT } from "./prompts"
import { reviewSummary } from "./reviewer"
import { RESPONSE_SCHEMA, type DocType, type LlmMode, type ReviewPayload } from "./types"
import {
  assessProseQuality,
  buildTemplateFallback,
  extractTitleFromMarkdown,
  isSkipPayload,
  isSummaryPayload,
  looksLikeBrokenJson,
  normalizeSummary,
  parseLlmPayload,
  stripCodeFence,
  writeRawResponseLog,
} from "./utilities"

export async function writeSummary(input: {
  transcript: string
  existingDocs: ExistingDoc[]
  narrowTopic?: string
  docType?: DocType
}, traceParent?: TraceRun): Promise<SummaryPayload | null> {
  const userMessage = buildWriterUserMessage(input)

  const createPayload = (retryForJsonOnly: boolean, temperature: number) => ({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "system" as const,
        content: buildSystemPrompt(WRITER_SYSTEM_PROMPT, retryForJsonOnly),
      },
      { role: "user" as const, content: userMessage },
    ],
    temperature,
    response_format: {
      type: "json_schema" as const,
      json_schema: RESPONSE_SCHEMA,
    },
  })

  const requestSummary = async (
    phase: string,
    retryForJsonOnly: boolean,
    temperature: number,
    modeOverride?: LlmMode,
  ): Promise<{ raw: string; mode: LlmMode; finishReason: string }> => {
    const reqTrace = await tracer.startRun(
      `dev-log.llm.write.${phase}`,
      "llm",
      {
        retryForJsonOnly,
        temperature,
        modeOverride: modeOverride ?? "json-schema",
        systemPrompt: WRITER_SYSTEM_PROMPT,
        userMessage,
      },
      traceParent,
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
      return outputs
    }

    try {
      const response = await withRetry(() => llmClient.chat.completions.create(createPayload(retryForJsonOnly, temperature)))
      const outputs: { raw: string; mode: "json-schema"; finishReason: string } = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-schema",
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(reqTrace, { outputs })
      return outputs
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
      return outputs
    }
  }

  const requestRewrite = async (
    rewriteInstruction: string,
    mode: LlmMode,
  ): Promise<{ raw: string; mode: LlmMode; finishReason: string }> => {
    const rewriteTrace = await tracer.startRun(
      "dev-log.llm.rewrite",
      "llm",
      { rewriteInstruction, mode },
      traceParent,
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
      return outputs
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
    return outputs
  }

  const applyQualityGate = async (summary: SummaryPayload, mode: LlmMode): Promise<SummaryPayload> => {
    const quality = assessProseQuality(summary.markdown)
    await writeTrace(
      `quality_gate=${quality.pass ? "pass" : "fail"} reason=${quality.reason} ratio=${quality.ratio.toFixed(2)} headings=${quality.headingLines} paragraphs=${quality.paragraphs} words=${quality.wordCount}`,
    )
    if (quality.pass) return summary

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
${JSON.stringify(summary)}`

    try {
      const rewrite = await requestRewrite(rewritePrompt, mode)
      await writeTrace(`llm finish_reason=${rewrite.finishReason} mode=${rewrite.mode} (quality-rewrite)`)
      if (!rewrite.raw) return summary
      await writeRawResponseLog(rewrite.raw)
      const rewriteParsed = parseLlmPayload(rewrite.raw)
      if (!rewriteParsed.payload || isSkipPayload(rewriteParsed.payload) || !isSummaryPayload(rewriteParsed.payload)) return summary
      const rewritten = normalizeSummary(rewriteParsed.payload)
      const rewrittenQuality = assessProseQuality(rewritten.markdown)
      await writeTrace(
        `quality_gate=${rewrittenQuality.pass ? "pass" : "fail"} reason=${rewrittenQuality.reason} ratio=${rewrittenQuality.ratio.toFixed(2)} headings=${rewrittenQuality.headingLines} paragraphs=${rewrittenQuality.paragraphs} words=${rewrittenQuality.wordCount} phase=quality-rewrite`,
      )
      return rewrittenQuality.pass ? rewritten : summary
    } catch (error) {
      await writeTrace(`llm quality rewrite failed err=${error instanceof Error ? error.message : "unknown"}`)
      return summary
    }
  }

  const buildReviewerRewritePrompt = (summary: SummaryPayload, review: ReviewPayload): string => {
    const instructions = (review.rewriteInstructions ?? []).filter(Boolean).slice(0, 5)
    const issues = (review.issues ?? []).slice(0, 5).map((issue) => `- [${issue.severity}/${issue.category}] ${issue.message}`)

    return `다음 개인 위키 초안을 reviewer 지시에 맞게 수정하세요.
세션에 없는 사실을 추가하지 말고, 기존 사실을 왜곡하지 마세요.

수정 지시:
${instructions.length > 0 ? instructions.map((instruction) => `- ${instruction}`).join("\n") : "- reviewer 지적 사항만 반영하세요"}

검수 이슈:
${issues.length > 0 ? issues.join("\n") : "- 없음"}

절대 금지:
- 새 사실 추가
- 세션에 없는 비교나 일반론 추가
- title 과 tags 를 불필요하게 바꾸기
- 실제 세션 코드를 복사해 넣기

허용:
- title narrowing
- TL;DR 강화
- 용어 통일
- 개념 첫 등장 정의 보강
- 부적절한 pseudocode/mermaid 제거 또는 더 짧게 축약

반드시 JSON 객체 하나만 출력:
{"action":"overwrite|new","targetPath":"","title":"","tags":[],"markdown":""}

원본 JSON:
${JSON.stringify(summary)}`
  }

  const applyReviewer = async (summary: SummaryPayload, mode: LlmMode): Promise<SummaryPayload> => {
    const review = await reviewSummary(
      {
        transcript: input.transcript,
        existingDocs: input.existingDocs,
        summary,
        narrowTopic: input.narrowTopic,
        docType: input.docType,
      },
      traceParent,
    )
    if (!review) return summary

    await writeTrace(
      `review decision=${review.decision} issues=${(review.issues ?? []).length} instructions=${(review.rewriteInstructions ?? []).length}`,
    )
    if (review.decision === "pass") return summary

    try {
      const rewrite = await requestRewrite(buildReviewerRewritePrompt(summary, review), mode)
      await writeTrace(`llm finish_reason=${rewrite.finishReason} mode=${rewrite.mode} (review-rewrite)`)
      if (!rewrite.raw) return summary
      await writeRawResponseLog(rewrite.raw)
      const rewriteParsed = parseLlmPayload(rewrite.raw)
      if (!rewriteParsed.payload || isSkipPayload(rewriteParsed.payload) || !isSummaryPayload(rewriteParsed.payload)) return summary

      const rewritten = await applyQualityGate(normalizeSummary(rewriteParsed.payload), rewrite.mode)
      const finalReview = await reviewSummary(
        {
          transcript: input.transcript,
          existingDocs: input.existingDocs,
          summary: rewritten,
          narrowTopic: input.narrowTopic,
          docType: input.docType,
        },
        traceParent,
      )

      if (!finalReview) return rewritten
      await writeTrace(
        `review decision=${finalReview.decision} issues=${(finalReview.issues ?? []).length} instructions=${(finalReview.rewriteInstructions ?? []).length} phase=post-rewrite`,
      )
      if (finalReview.decision === "pass") return rewritten
      return rewritten
    } catch (error) {
      await writeTrace(`llm review rewrite failed err=${error instanceof Error ? error.message : "unknown"}`)
      return summary
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
          const qualityCheckedRetry = await applyQualityGate(normalizedRetry, retry.mode)
          return applyReviewer(qualityCheckedRetry, retry.mode)
        }
      }
    }

    const markdownFallback = stripCodeFence(raw).trim()
    if (!markdownFallback) return buildTemplateFallback(raw)
    if (looksLikeBrokenJson(markdownFallback)) {
      await writeTrace("llm fallback blocked: broken-json-like output")
      return buildTemplateFallback(raw)
    }

    await writeTrace(`llm fallback markdown len=${markdownFallback.length}`)
    return {
      action: "new",
      targetPath: "",
      title: extractTitleFromMarkdown(markdownFallback),
      tags: ["needs-review"],
      markdown: markdownFallback,
    }
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
  const qualityChecked = await applyQualityGate(normalized, structuredMode)
  return applyReviewer(qualityChecked, structuredMode)
}
