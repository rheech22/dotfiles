import { basename } from "path"
import { writeTrace } from "../observability/logger"

type NotifyResult = "success" | "failure"

function buildMessage(result: NotifyResult, outPath: string, sessionId: string): { title: string; message: string } {
  if (result === "success") {
    return {
      title: "Uploaded",
      message: basename(outPath),
    }
  }
  return {
    title: "Upload Failed",
    message: `${sessionId.slice(0, 8)} ${basename(outPath)}`,
  }
}

export async function notifyUploadResult(
  $: any,
  result: NotifyResult,
  outPath: string,
  sessionId: string,
): Promise<void> {
  const payload = buildMessage(result, outPath, sessionId)
  try {
    await $`osascript -e 'display notification "${payload.message}" with title "${payload.title}"'`
  } catch (error) {
    try {
      await writeTrace(
        `notify_failed result=${result} err=${error instanceof Error ? error.message : "unknown"}`,
      )
    } catch {
      // noop
    }
  }
}
