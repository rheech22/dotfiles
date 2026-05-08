import { REVIEWER_MODEL } from "../config"
import { writeTrace } from "../logger"
import { tracer, type TraceRun } from "../tracing"
import type { ExistingDoc, SummaryPayload } from "../types"
import { withRetry } from "../utils"
import { llmClient } from "./client"
import { buildReviewerUserMessage, buildSystemPrompt, REVIEWER_SYSTEM_PROMPT } from "./prompts"
import { REVIEW_SCHEMA, type DocType, type LlmMode, type ReviewPayload } from "./types"
import { isReviewPayload, parseReviewPayload } from "./utilities"

export async function reviewSummary(input: {
  transcript: string
  existingDocs: ExistingDoc[]
  summary: SummaryPayload
  narrowTopic?: string
  docType?: DocType
}, traceParent?: TraceRun): Promise<ReviewPayload | null> {
  const userMessage = buildReviewerUserMessage({
    transcript: input.transcript,
    existingDocs: input.existingDocs,
    summary: JSON.stringify(input.summary),
    narrowTopic: input.narrowTopic,
    docType: input.docType,
  })

  const requestReview = async (
    phase: string,
    retryForJsonOnly: boolean,
    modeOverride?: LlmMode,
  ): Promise<{ raw: string; mode: LlmMode; finishReason: string }> => {
    const reqTrace = await tracer.startRun(
      `dev-log.llm.review.${phase}`,
      "llm",
      {
        retryForJsonOnly,
        modeOverride: modeOverride ?? "json-schema",
        systemPrompt: REVIEWER_SYSTEM_PROMPT,
        userMessage,
        model: REVIEWER_MODEL,
      },
      traceParent,
    )

    if (modeOverride === "json-object") {
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          model: REVIEWER_MODEL,
          max_tokens: 700,
          messages: [
            { role: "system", content: buildSystemPrompt(REVIEWER_SYSTEM_PROMPT, retryForJsonOnly) },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" as const },
        }),
      )
      const outputs = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-object" as const,
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(reqTrace, { outputs })
      return outputs
    }

    try {
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          model: REVIEWER_MODEL,
          max_tokens: 700,
          messages: [
            { role: "system", content: buildSystemPrompt(REVIEWER_SYSTEM_PROMPT, retryForJsonOnly) },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          response_format: { type: "json_schema" as const, json_schema: REVIEW_SCHEMA },
        }),
      )
      const outputs = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-schema" as const,
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(reqTrace, { outputs })
      return outputs
    } catch (error) {
      await writeTrace(`llm review structured schema failed err=${error instanceof Error ? error.message : "unknown"}`)
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          model: REVIEWER_MODEL,
          max_tokens: 700,
          messages: [
            { role: "system", content: buildSystemPrompt(REVIEWER_SYSTEM_PROMPT, retryForJsonOnly) },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" as const },
        }),
      )
      const outputs = {
        raw: response.choices[0]?.message?.content ?? "",
        mode: "json-object" as const,
        finishReason: response.choices[0]?.finish_reason ?? "unknown",
      }
      await tracer.endRun(reqTrace, { outputs, extra: { structuredFallback: true } })
      return outputs
    }
  }

  const first = await requestReview("primary", false)
  await writeTrace(`llm review finish_reason=${first.finishReason} mode=${first.mode}`)
  const parsed = parseReviewPayload(first.raw)
  if (parsed.payload && isReviewPayload(parsed.payload)) return parsed.payload

  await writeTrace(
    `llm review parse failed mode=${parsed.mode} err=${parsed.error ?? "unknown"} len=${first.raw.length} raw=${first.raw.slice(0, 220).replace(/\n/g, " ")}`,
  )

  const retry = await requestReview("retry", true, first.mode)
  await writeTrace(`llm review finish_reason=${retry.finishReason} mode=${retry.mode} (retry)`)
  const retryParsed = parseReviewPayload(retry.raw)
  if (retryParsed.payload && isReviewPayload(retryParsed.payload)) return retryParsed.payload

  await writeTrace(
    `llm review fallback pass err=${retryParsed.error ?? parsed.error ?? "unknown"} raw=${retry.raw.slice(0, 220).replace(/\n/g, " ")}`,
  )
  return null
}
