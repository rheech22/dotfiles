import { readFile, writeFile } from "fs/promises"
import { TRACE_LOG } from "./config"

const MAX_TRACE_LINES = 3000

export async function writeTrace(message: string): Promise<void> {
  const line = `${new Date().toISOString()} ${message}\n`
  let prev = ""
  try {
    prev = await readFile(TRACE_LOG, "utf-8")
  } catch {
    prev = ""
  }
  const next = `${prev}${line}`
  const lines = next.split("\n")
  const normalized = lines.at(-1) === "" ? lines.slice(0, -1) : lines
  const trimmed = normalized.slice(-MAX_TRACE_LINES).join("\n") + "\n"
  await writeFile(TRACE_LOG, trimmed, "utf-8")
}
