import { join, resolve } from "path"
import { LOG_DIR } from "./config"
import { summarizeSession } from "./llm"
import { writeTrace } from "./logger"
import {
  buildFrontmatter,
  composeDocument,
  readCreatedFromExisting,
  readExistingDocs,
  toSlug,
  writeMarkdown,
} from "./storage"
import { flushSessionPartBuffers, getSessionBuffer } from "./state"
import { tracer } from "./tracing"
import { buildTranscript, extractMessagesFromEventProperties } from "./transcript"
import type { SessionMessage } from "./types"
import { uploadWithPending } from "./upload"
import { sleep } from "./utils"
import { notifyUploadResult } from "./notify"

function isSafeLogPath(path: string): boolean {
  const resolved = resolve(path)
  const resolvedLogDir = resolve(LOG_DIR)
  return (resolved === resolvedLogDir || resolved.startsWith(`${resolvedLogDir}/`)) && resolved.endsWith(".md")
}

async function fetchSessionMessagesWithBackoff(ocClient: unknown, sessionId: string): Promise<SessionMessage[]> {
  const delays = [0, 300, 800, 1500]
  const client = ocClient as {
    session: { messages: (input: { sessionID: string }) => Promise<unknown> }
  }
  for (let i = 0; i < delays.length; i += 1) {
    if (delays[i] > 0) await sleep(delays[i])
    const messages = (await client.session.messages({ sessionID: sessionId })) as SessionMessage[]
    await writeTrace(`session=${sessionId} messages_attempt=${i + 1} count=${messages?.length ?? 0}`)
    if (messages && messages.length > 0) return messages
  }
  return []
}

export async function processSessionIdle(params: {
  ocClient: unknown
  $: any
  sessionId: string
  eventProperties: unknown
  eventKeys: string[]
}): Promise<void> {
  const { ocClient, $, sessionId, eventProperties, eventKeys } = params

  const rootTrace = await tracer.startRun(
    "dev-log.session_idle",
    "chain",
    {
      sessionId,
      eventKeys,
      eventProperties,
    },
  )

  let traceError: string | undefined

  try {
    const streamFlushed = flushSessionPartBuffers(sessionId)
    if (streamFlushed > 0) await writeTrace(`session=${sessionId} stream_flushed=${streamFlushed}`)

    const bufferedMessages = getSessionBuffer(sessionId)
    await writeTrace(`session=${sessionId} buffer_messages=${bufferedMessages.length}`)

    const messages = bufferedMessages.length > 0 ? bufferedMessages : await fetchSessionMessagesWithBackoff(ocClient, sessionId)
    await writeTrace(`session=${sessionId} messages_final=${messages?.length ?? 0}`)

    const fallbackMessages = extractMessagesFromEventProperties(eventProperties)
    if (messages.length === 0 && fallbackMessages.length > 0) {
      await writeTrace(`session=${sessionId} fallback_messages=${fallbackMessages.length}`)
    }

    const usableMessages = messages.length > 0 ? messages : fallbackMessages
    if (usableMessages.length < 2) {
      await writeTrace(`session=${sessionId} skipped: too few messages eventKeys=${eventKeys.join(",")}`)
      return
    }

    const transcript = buildTranscript(usableMessages)
    if (!transcript) {
      await writeTrace(`session=${sessionId} skipped: empty transcript`)
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const existingDocs = await readExistingDocs(sessionId)
    const summary = await summarizeSession({ today, transcript, existingDocs }, rootTrace ?? undefined)
    if (!summary) {
      await writeTrace(`session=${sessionId} skipped: model_signaled_skip_or_invalid_response`)
      await tracer.endRun(rootTrace, {
        outputs: {
          result: "skip",
        },
      })
      return
    }

    const shortId = sessionId.slice(0, 8)
    if (summary.targetPath) {
      await writeTrace(`session=${sessionId} model_targetPath_ignored path=${summary.targetPath}`)
    }

    const overwritePath = summary.action === "overwrite" ? existingDocs[0]?.path : undefined
    const outPath =
      summary.action === "overwrite" && overwritePath
        ? overwritePath
        : join(LOG_DIR, `${today}-${shortId}-${toSlug(summary.title)}.md`)

    if (!isSafeLogPath(outPath)) {
      await writeTrace(`session=${sessionId} blocked: unsafe_outPath=${outPath}`)
      return
    }

    const now = new Date()
    const createdAt = summary.action === "overwrite"
      ? (await readCreatedFromExisting(outPath)) ?? now
      : now

    const frontmatter = buildFrontmatter({
      title: summary.title,
      tags: summary.tags,
      sessionId: shortId,
      createdAt,
      updatedAt: now,
    })

    const fullDocument = composeDocument(frontmatter, summary.markdown)
    await writeMarkdown(outPath, fullDocument)
    await writeTrace(`session=${sessionId} wrote=${outPath}`)

    const pendingPath = await uploadWithPending($, outPath, shortId)
    if (pendingPath) {
      await writeTrace(`session=${sessionId} upload=failed pending=${pendingPath}`)
      await notifyUploadResult($, "failure", outPath, sessionId)
      await tracer.endRun(rootTrace, {
        outputs: {
          result: "pending",
          outPath,
          pendingPath,
        },
      })
      return
    }
    await writeTrace(`session=${sessionId} upload=ok`)
    await notifyUploadResult($, "success", outPath, sessionId)
    await tracer.endRun(rootTrace, {
      outputs: {
        result: "ok",
        outPath,
        summary,
      },
    })
  } catch (error) {
    traceError = error instanceof Error ? error.message : "unknown"
    await tracer.endRun(rootTrace, {
      outputs: {
        result: "error",
      },
      error: traceError,
    })
    throw error
  }
}
