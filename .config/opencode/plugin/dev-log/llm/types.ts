import type { SummaryPayload } from "../types"

export type SkipPayload = { action: "skip"; reason?: string }
export type LlmPayload = SummaryPayload | SkipPayload
export type ParseResult = { payload: LlmPayload | null; mode: string; error?: string }
export type LlmMode = "json-schema" | "json-object"
export type ClassificationDecision = "skip" | "proceed"
export type ClassificationPayload = {
  decision: ClassificationDecision
  narrowTopic?: string
  reason?: string
}
export type ClassificationParseResult = { payload: ClassificationPayload | null; mode: string; error?: string }

export const CLASSIFICATION_SCHEMA = {
  name: "dev_log_classification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      decision: { type: "string", enum: ["skip", "proceed"] },
      narrowTopic: { type: "string" },
      reason: { type: "string" },
    },
    required: ["decision"],
    additionalProperties: false,
  },
} as const

export const RESPONSE_SCHEMA = {
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
