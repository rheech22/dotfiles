import { MAX_MESSAGES } from "./config"
import { writeTrace } from "./logger"
import type { MessageDeltaProperties, MessagePartUpdatedProperties, SessionMessage } from "./types"

export const inFlight = new Map<string, Promise<void>>()
const partBuffers = new Map<string, string>()
const sessionBuffers = new Map<string, SessionMessage[]>()

function partKey(sessionId: string, messageId: string, partId: string): string {
  return `${sessionId}:${messageId}:${partId}`
}

function pushSessionMessage(sessionId: string, message: SessionMessage): void {
  const prev = sessionBuffers.get(sessionId) ?? []
  sessionBuffers.set(sessionId, [...prev, message].slice(-MAX_MESSAGES))
}

export function appendDelta(properties: MessageDeltaProperties): void {
  if (!properties.sessionID || !properties.messageID || !properties.partID) return
  if (properties.field !== "text") return
  const key = partKey(properties.sessionID, properties.messageID, properties.partID)
  const prev = partBuffers.get(key) ?? ""
  partBuffers.set(key, `${prev}${properties.delta ?? ""}`)
}

export async function finalizePart(properties: MessagePartUpdatedProperties): Promise<void> {
  if (!properties.sessionID || !properties.part?.messageID || !properties.part?.id) return
  const key = partKey(properties.sessionID, properties.part.messageID, properties.part.id)
  const text = properties.part.text ?? partBuffers.get(key) ?? ""
  if (text.trim()) {
    pushSessionMessage(properties.sessionID, { role: "assistant", content: text })
    await writeTrace(`session=${properties.sessionID} finalized part=${properties.part.id} len=${text.length}`)
  }
  partBuffers.delete(key)
}

export function flushSessionPartBuffers(sessionId: string): number {
  let count = 0
  const prefix = `${sessionId}:`
  for (const [key, text] of partBuffers.entries()) {
    if (!key.startsWith(prefix)) continue
    if (text.trim()) {
      pushSessionMessage(sessionId, { role: "assistant", content: text })
      count += 1
    }
    partBuffers.delete(key)
  }
  return count
}

export function getSessionBuffer(sessionId: string): SessionMessage[] {
  return sessionBuffers.get(sessionId) ?? []
}
