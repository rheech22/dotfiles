import { classifySession } from "./classifier"
import { hasApiKey } from "./client"
import { writeSummary } from "./writer"
import { tracer, type TraceRun } from "../tracing"
import { writeTrace } from "../logger"
import type { ExistingDoc, SummaryPayload } from "../types"

export { hasApiKey }

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
    const classification = await classifySession(
      {
        transcript: input.transcript,
        existingDocs: input.existingDocs,
      },
      llmTrace ?? undefined,
    )

    await writeTrace(
      `classification decision=${classification.decision} narrow=${classification.narrowTopic ?? ""} reason=${classification.reason ?? ""}`,
    )
    if (classification.decision === "skip") return null

    finalSummary = await writeSummary(
      {
        transcript: input.transcript,
        existingDocs: input.existingDocs,
        narrowTopic: classification.narrowTopic,
      },
      llmTrace ?? undefined,
    )

    return finalSummary
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
