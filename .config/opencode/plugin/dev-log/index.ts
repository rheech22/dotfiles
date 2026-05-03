import type { Plugin } from "@opencode-ai/plugin"
import { mkdir } from "fs/promises"
import { API_KEY, LOG_DIR, PENDING_DIR } from "./config"
import { writeTrace } from "./logger"
import { hasApiKey } from "./llm"
import { processSessionIdle } from "./orchestrator"
import type {
  IdleEventProperties,
  MessageDeltaProperties,
  MessagePartUpdatedProperties,
  RawEvent,
} from "./types"
import { appendDelta, finalizePart, inFlight } from "./state"

function getSessionId(properties: unknown): string | null {
  if (!properties || typeof properties !== "object") return null
  const sessionID = (properties as { sessionID?: unknown }).sessionID
  return typeof sessionID === "string" && sessionID ? sessionID : null
}

export const DevLogPlugin: Plugin = async ({ client: ocClient, $ }) => {
  await mkdir(LOG_DIR, { recursive: true })
  await mkdir(PENDING_DIR, { recursive: true })
  await writeTrace("plugin initialized")

  return {
    event: async ({ event }) => {
      const rawEvent = event as unknown as RawEvent
      const eventKeys = Object.keys((rawEvent.properties ?? {}) as Record<string, unknown>)
      await writeTrace(`event type=${rawEvent.type} keys=${eventKeys.join(",")}`)

      if (rawEvent.type === "message.part.delta") {
        appendDelta(rawEvent.properties as MessageDeltaProperties)
        return
      }

      if (rawEvent.type === "message.part.updated") {
        await finalizePart(rawEvent.properties as MessagePartUpdatedProperties)
        return
      }

      if (rawEvent.type !== "session.idle") return
      await writeTrace("session.idle received")
      if (!API_KEY || !hasApiKey()) return

      const sessionId = getSessionId(rawEvent.properties as IdleEventProperties)
      if (!sessionId) {
        await writeTrace("session.idle skipped: missing sessionID")
        return
      }

      await writeTrace(`session=${sessionId} queued`)
      const prev = inFlight.get(sessionId) ?? Promise.resolve()
      const job = prev.then(async () => {
        try {
          await processSessionIdle({
            ocClient,
            $,
            sessionId,
            eventProperties: rawEvent.properties,
            eventKeys,
          })
        } catch (error) {
          await writeTrace(`session=${sessionId} fatal=${error instanceof Error ? error.message : "unknown"}`)
        }
      })
      inFlight.set(sessionId, job)
      await job.finally(() => {
        if (inFlight.get(sessionId) === job) inFlight.delete(sessionId)
      })
      await writeTrace(`session=${sessionId} done`)
    },
  }
}
