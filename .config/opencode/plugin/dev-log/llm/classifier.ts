import { CLASSIFIER_MODEL } from "../config"
import { writeTrace } from "../logger"
import { tracer, type TraceRun } from "../tracing"
import type { ExistingDoc } from "../types"
import { withRetry } from "../utils"
import { llmClient } from "./client"
import { buildClassifierUserMessage, buildSystemPrompt, CLASSIFIER_SYSTEM_PROMPT } from "./prompts"
import { CLASSIFICATION_SCHEMA, type ClassificationPayload, type LlmMode } from "./types"
import { isClassificationPayload, parseClassificationPayload } from "./utilities"

export async function classifySession(input: {
  transcript: string
  existingDocs: ExistingDoc[]
}, traceParent?: TraceRun): Promise<ClassificationPayload> {
  const userMessage = buildClassifierUserMessage(input)

  const requestClassification = async (
    phase: string,
    retryForJsonOnly: boolean,
    modeOverride?: LlmMode,
  ): Promise<{ raw: string; mode: LlmMode; finishReason: string }> => {
    const reqTrace = await tracer.startRun(
      `dev-log.llm.classify.${phase}`,
      "llm",
      {
        retryForJsonOnly,
        modeOverride: modeOverride ?? "json-schema",
        systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
        userMessage,
        model: CLASSIFIER_MODEL,
      },
      traceParent,
    )

    if (modeOverride === "json-object") {
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          model: CLASSIFIER_MODEL,
          max_tokens: 300,
          messages: [
            { role: "system", content: buildSystemPrompt(CLASSIFIER_SYSTEM_PROMPT, retryForJsonOnly) },
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
          model: CLASSIFIER_MODEL,
          max_tokens: 300,
          messages: [
            { role: "system", content: buildSystemPrompt(CLASSIFIER_SYSTEM_PROMPT, retryForJsonOnly) },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          response_format: { type: "json_schema" as const, json_schema: CLASSIFICATION_SCHEMA },
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
      await writeTrace(`llm classification structured schema failed err=${error instanceof Error ? error.message : "unknown"}`)
      const response = await withRetry(() =>
        llmClient.chat.completions.create({
          model: CLASSIFIER_MODEL,
          max_tokens: 300,
          messages: [
            { role: "system", content: buildSystemPrompt(CLASSIFIER_SYSTEM_PROMPT, retryForJsonOnly) },
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

  const first = await requestClassification("primary", false)
  await writeTrace(`llm classification finish_reason=${first.finishReason} mode=${first.mode}`)
  const parsed = parseClassificationPayload(first.raw)
  if (parsed.payload && isClassificationPayload(parsed.payload)) return parsed.payload

  await writeTrace(
    `llm classification parse failed mode=${parsed.mode} err=${parsed.error ?? "unknown"} len=${first.raw.length} raw=${first.raw.slice(0, 220).replace(/\n/g, " ")}`,
  )

  const retry = await requestClassification("retry", true, first.mode)
  await writeTrace(`llm classification finish_reason=${retry.finishReason} mode=${retry.mode} (retry)`)
  const retryParsed = parseClassificationPayload(retry.raw)
  if (retryParsed.payload && isClassificationPayload(retryParsed.payload)) return retryParsed.payload

  await writeTrace(
    `llm classification fallback proceed err=${retryParsed.error ?? parsed.error ?? "unknown"} raw=${retry.raw.slice(0, 220).replace(/\n/g, " ")}`,
  )
  return {
    decision: "proceed",
    reason: "classification-parse-failed",
  }
}
