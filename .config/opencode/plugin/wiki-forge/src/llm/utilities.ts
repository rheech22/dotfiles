import { appendFile, mkdir } from "fs/promises"
import { dirname } from "path"
import { LOG_DIR } from "../config"
import type { SummaryPayload } from "../types"
import type {
  ClassificationParseResult,
  ClassificationPayload,
  LlmPayload,
  ParseResult,
  ReviewParseResult,
  ReviewPayload,
} from "./types"

export function isSkipPayload(payload: LlmPayload): payload is { action: "skip"; reason?: string } {
  return payload.action === "skip"
}

export function isSummaryPayload(payload: LlmPayload): payload is SummaryPayload {
  if (payload.action !== "new" && payload.action !== "overwrite") return false
  if (typeof payload.title !== "string" || payload.title.trim().length === 0) return false
  if (typeof payload.markdown !== "string" || payload.markdown.trim().length === 0) return false
  if (!Array.isArray(payload.tags)) return false
  if (!payload.tags.every((tag: unknown) => typeof tag === "string")) return false
  return true
}

export function isClassificationPayload(payload: ClassificationPayload): payload is ClassificationPayload {
  if (payload.decision !== "skip" && payload.decision !== "proceed") return false
  if (payload.narrowTopic !== undefined && typeof payload.narrowTopic !== "string") return false
  if (payload.docType !== undefined && payload.docType !== "reference" && payload.docType !== "explanation") return false
  if (payload.reason !== undefined && typeof payload.reason !== "string") return false
  return true
}

export function isReviewPayload(payload: ReviewPayload): payload is ReviewPayload {
  if (payload.decision !== "pass" && payload.decision !== "revise") return false
  if (payload.issues !== undefined) {
    if (!Array.isArray(payload.issues)) return false
    for (const issue of payload.issues) {
      if (typeof issue !== "object" || issue === null) return false
      if (issue.severity !== "high" && issue.severity !== "medium" && issue.severity !== "low") return false
      if (!["scope", "value", "accuracy", "style", "terminology", "structure", "visual"].includes(issue.category)) return false
      if (typeof issue.message !== "string") return false
    }
  }
  if (payload.rewriteInstructions !== undefined) {
    if (!Array.isArray(payload.rewriteInstructions)) return false
    if (!payload.rewriteInstructions.every((instruction: unknown) => typeof instruction === "string")) return false
  }
  return true
}

export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("```")) return raw
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
}

export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

export function parseLlmPayload(raw: string): ParseResult {
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

export function parseClassificationPayload(raw: string): ClassificationParseResult {
  try {
    return { payload: JSON.parse(raw) as ClassificationPayload, mode: "json" }
  } catch (error) {
    const fenced = stripCodeFence(raw)
    if (fenced !== raw) {
      try {
        return { payload: JSON.parse(fenced) as ClassificationPayload, mode: "fenced-json" }
      } catch {
        // continue
      }
    }
    const extracted = extractJsonObject(raw)
    if (extracted) {
      try {
        return { payload: JSON.parse(extracted) as ClassificationPayload, mode: "sliced-json" }
      } catch {
        // continue
      }
    }
    const message = error instanceof Error ? error.message : "unknown"
    return { payload: null, mode: "parse-failed", error: message }
  }
}

export function parseReviewPayload(raw: string): ReviewParseResult {
  try {
    return { payload: JSON.parse(raw) as ReviewPayload, mode: "json" }
  } catch (error) {
    const fenced = stripCodeFence(raw)
    if (fenced !== raw) {
      try {
        return { payload: JSON.parse(fenced) as ReviewPayload, mode: "fenced-json" }
      } catch {
        // continue
      }
    }
    const extracted = extractJsonObject(raw)
    if (extracted) {
      try {
        return { payload: JSON.parse(extracted) as ReviewPayload, mode: "sliced-json" }
      } catch {
        // continue
      }
    }
    const message = error instanceof Error ? error.message : "unknown"
    return { payload: null, mode: "parse-failed", error: message }
  }
}

export function extractTitleFromMarkdown(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const heading = lines.find((line) => line.startsWith("# ") || line.startsWith("## "))
  if (heading) return heading.replace(/^#{1,2}\s+/, "").slice(0, 80)
  return (lines[0] ?? "session").slice(0, 80)
}

export function looksLikeBrokenJson(raw: string): boolean {
  const trimmed = raw.trim()
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false
  const openCurly = (trimmed.match(/\{/g) ?? []).length
  const closeCurly = (trimmed.match(/\}/g) ?? []).length
  const openSquare = (trimmed.match(/\[/g) ?? []).length
  const closeSquare = (trimmed.match(/\]/g) ?? []).length
  return openCurly !== closeCurly || openSquare !== closeSquare
}

export function buildTemplateFallback(raw: string): SummaryPayload {
  const snippet = raw.slice(0, 1200).trim()
  return {
    action: "new",
    targetPath: "",
    title: "Session Note (parse failed)",
    tags: ["needs-review"],
    markdown: `LLM 출력 파싱에 실패해 최소 문서로 저장했습니다. 검토 후 정리하거나 삭제하세요.\n\nRaw snippet:\n\n\`\`\`text\n${snippet}\n\`\`\``,
  }
}

export function normalizeSummary(summary: SummaryPayload): SummaryPayload {
  const tags = Array.from(new Set(summary.tags.map((tag: string) => tag.trim()).filter(Boolean)))
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

export function assessProseQuality(markdown: string): {
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

export async function writeRawResponseLog(raw: string): Promise<void> {
  const ts = new Date().toISOString()
  const entry = [`\n===== LLM RAW RESPONSE ${ts} =====`, raw, "===== END =====\n"].join("\n")
  const outPath = `${LOG_DIR}/wiki-forge.llm-raw.log`
  await mkdir(dirname(outPath), { recursive: true })
  await appendFile(outPath, entry, "utf-8")
}
