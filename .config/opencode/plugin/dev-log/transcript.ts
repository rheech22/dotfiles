import { MAX_MESSAGES, MAX_TRANSCRIPT_CHARS } from "./config"
import type { SessionMessage } from "./types"

export function maskSecrets(input: string): string {
  return input
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/AIza[0-9A-Za-z-_]{20,}/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED_PEM]")
    .replace(/(password|token|secret)\s*[=:]\s*[^\s'\"]+/gi, "$1=[REDACTED]")
}

export function buildTranscript(messages: SessionMessage[]): string {
  const text = messages
    .slice(-MAX_MESSAGES)
    .map((msg) => {
      const role = msg.role ?? ""
      let content = msg.content ?? ""
      if (Array.isArray(content)) {
        content = content.filter((p) => p.type === "text").map((p) => p.text).join(" ")
      }
      return content ? `### ${role}\n${content}` : null
    })
    .filter((value): value is string => value !== null)
    .join("\n\n")
  return maskSecrets(text).slice(-MAX_TRANSCRIPT_CHARS)
}

function isSessionMessageArray(value: unknown): value is SessionMessage[] {
  if (!Array.isArray(value)) return false
  return value.every((item) => typeof item === "object" && item !== null && "content" in item)
}

function collectCandidateMessageArrays(input: unknown, depth = 0): SessionMessage[][] {
  if (depth > 4 || input === null || input === undefined) return []
  if (isSessionMessageArray(input)) return [input]
  if (Array.isArray(input)) return input.flatMap((item) => collectCandidateMessageArrays(item, depth + 1))
  if (typeof input === "object") {
    return Object.values(input as Record<string, unknown>).flatMap((value) =>
      collectCandidateMessageArrays(value, depth + 1),
    )
  }
  return []
}

export function extractMessagesFromEventProperties(properties: unknown): SessionMessage[] {
  const candidates = collectCandidateMessageArrays(properties)
  if (candidates.length === 0) return []
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0] ?? []
}
