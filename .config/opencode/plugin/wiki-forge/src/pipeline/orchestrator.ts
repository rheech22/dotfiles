import { resolve } from "path"
import { OUTPUT_DIR } from "../config"
import { summarizeSession } from "../llm"
import { writeTrace } from "../observability/logger"
import {
  buildFrontmatter,
  composeDocument,
  ensureIndexEntry,
  findDuplicateDocumentPaths,
  readCreatedFromExisting,
  readExistingDocs,
  toDocumentPath,
  toFileSlug,
  writeMarkdown,
} from "../storage"
import { flushSessionPartBuffers, getSessionBuffer } from "./state"
import { tracer } from "../observability/tracing"
import { buildTranscript, extractMessagesFromEventProperties } from "./transcript"
import type { ExistingDoc, SessionMessage } from "../types"
import { sleep } from "../utils"

function isSafeLogPath(path: string): boolean {
  const resolved = resolve(path)
  const resolvedOutputDir = resolve(OUTPUT_DIR)
  return (resolved === resolvedOutputDir || resolved.startsWith(`${resolvedOutputDir}/`)) && resolved.endsWith(".md")
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
  sessionId: string
  eventProperties: unknown
  eventKeys: string[]
}): Promise<void> {
  const { ocClient, sessionId, eventProperties, eventKeys } = params

  const rootTrace = await tracer.startRun(
    "wiki-forge.session_idle",
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
    const existingDocs: ExistingDoc[] = []
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

    if (summary.targetPath) {
      await writeTrace(`session=${sessionId} model_targetPath_ignored path=${summary.targetPath}`)
    }

    const shortId = sessionId.slice(0, 8)
    const filename = toFileSlug(summary.filename || "session")
    const matchedDocs = await readExistingDocs(filename)
    const overwritePath = matchedDocs[0]?.path
    const outPath = overwritePath ?? toDocumentPath(filename)

    if (!isSafeLogPath(outPath)) {
      await writeTrace(`session=${sessionId} blocked: unsafe_outPath=${outPath}`)
      return
    }

    const now = new Date()
    const createdAt = overwritePath
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

    const duplicatePaths = await findDuplicateDocumentPaths(outPath)
    if (duplicatePaths.length > 0) {
      await writeTrace(`session=${sessionId} duplicate_candidates=${duplicatePaths.join(",")}`)
    }

    if (!overwritePath) {
      await ensureIndexEntry(outPath, summary.title)
      await writeTrace(`session=${sessionId} index=updated path=${outPath}`)
    }

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
