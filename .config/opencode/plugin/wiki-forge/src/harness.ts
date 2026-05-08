import { classifySession } from "./llm/classifier"
import { writeSummary } from "./llm/writer"
import type { ClassificationPayload } from "./llm/types"
import type { ExistingDoc, SummaryPayload } from "./types"

export type PipelineHarnessInput = {
  today?: string
  transcript: string
  existingDocs?: ExistingDoc[]
}

export type PipelineHarnessResult = {
  today: string
  classification: ClassificationPayload
  summary: SummaryPayload | null
}

export async function runTranscriptPipeline(input: PipelineHarnessInput): Promise<PipelineHarnessResult> {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const existingDocs = input.existingDocs ?? []
  const classification = await classifySession({
    transcript: input.transcript,
    existingDocs,
  })

  if (classification.decision === "skip") {
    return {
      today,
      classification,
      summary: null,
    }
  }

  const summary = await writeSummary({
    transcript: input.transcript,
    existingDocs,
    narrowTopic: classification.narrowTopic,
    docType: classification.docType,
  })

  return {
    today,
    classification,
    summary,
  }
}
