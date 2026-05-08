import type { SummaryPayload } from "../types"

export type SkipPayload = { action: "skip"; reason?: string }
export type LlmPayload = SummaryPayload | SkipPayload
export type ParseResult = { payload: LlmPayload | null; mode: string; error?: string }
export type LlmMode = "json-schema" | "json-object"
export type ClassificationDecision = "skip" | "proceed"
export type DocType = "reference" | "explanation"
export type ClassificationPayload = {
  decision: ClassificationDecision
  narrowTopic?: string
  docType?: DocType
  reason?: string
}
export type ClassificationParseResult = { payload: ClassificationPayload | null; mode: string; error?: string }
export type ReviewSeverity = "high" | "medium" | "low"
export type ReviewCategory = "scope" | "value" | "accuracy" | "style" | "terminology" | "structure" | "visual"
export type ReviewIssue = {
  severity: ReviewSeverity
  category: ReviewCategory
  message: string
}
export type ReviewDecision = "pass" | "revise"
export type ReviewPayload = {
  decision: ReviewDecision
  issues?: ReviewIssue[]
  rewriteInstructions?: string[]
}
export type ReviewParseResult = { payload: ReviewPayload | null; mode: string; error?: string }

export const CLASSIFICATION_SCHEMA = {
  name: "dev_log_classification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      decision: { type: "string", enum: ["skip", "proceed"] },
      narrowTopic: { type: "string" },
      docType: { type: "string", enum: ["reference", "explanation"] },
      reason: { type: "string" },
    },
    required: ["decision"],
    additionalProperties: false,
  },
} as const

export const REVIEW_SCHEMA = {
  name: "dev_log_review",
  strict: true,
  schema: {
    type: "object",
    properties: {
      decision: { type: "string", enum: ["pass", "revise"] },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["high", "medium", "low"] },
            category: { type: "string", enum: ["scope", "value", "accuracy", "style", "terminology", "structure", "visual"] },
            message: { type: "string" },
          },
          required: ["severity", "category", "message"],
          additionalProperties: false,
        },
      },
      rewriteInstructions: { type: "array", items: { type: "string" } },
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
