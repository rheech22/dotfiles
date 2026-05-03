import { readdir, readFile, writeFile } from "fs/promises"
import { join } from "path"
import { LOG_DIR } from "./config"
import type { ExistingDoc } from "./types"

export async function listSessionLogs(sessionId: string): Promise<string[]> {
  try {
    const shortId = sessionId.slice(0, 8)
    const files = await readdir(LOG_DIR)
    return files.filter((file) => file.endsWith(".md") && file.includes(`-${shortId}-`)).map((file) => join(LOG_DIR, file))
  } catch {
    return []
  }
}

export function toSlug(text: string): string {
  return text.trim().replace(/^#+\s*/, "").replace(/[^a-zA-Z0-9가-힣]+/g, "-").slice(0, 40).replace(/^-|-$/g, "").toLowerCase() || "session"
}

export async function readExistingDocs(sessionId: string): Promise<ExistingDoc[]> {
  const existingPaths = await listSessionLogs(sessionId)
  return Promise.all(existingPaths.map(async (path) => ({ path, content: await readFile(path, "utf-8") })))
}

export async function writeMarkdown(path: string, markdown: string): Promise<void> {
  await writeFile(path, markdown, "utf-8")
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function formatTimestamp(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  const ss = pad(d.getSeconds())

  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const oh = pad(Math.floor(Math.abs(offset) / 60))
  const om = pad(Math.abs(offset) % 60)

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} ${sign}${oh}${om}`
}

export function buildFrontmatter(meta: {
  title: string
  tags: string[]
  sessionId: string
  createdAt: Date
  updatedAt: Date
}): string {
  return `---\ncreated: ${formatTimestamp(meta.createdAt)}\nupdated: ${formatTimestamp(meta.updatedAt)}\ntitle: ${JSON.stringify(meta.title)}\ntags: ${JSON.stringify(meta.tags)}\nsession_id: ${meta.sessionId}\nsource: opencode\n---\n\n`
}

export function composeDocument(frontmatter: string, body: string): string {
  const cleaned = body.trimStart()
  return `${frontmatter}${cleaned}\n`
}

export async function readCreatedFromExisting(path: string): Promise<Date | null> {
  try {
    const content = await readFile(path, "utf-8")
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!fmMatch) return null
    const createdLine = fmMatch[1].split("\n").find((line) => line.startsWith("created:"))
    if (!createdLine) return null
    const value = createdLine.replace(/^created:\s*/, "").trim()
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return null
    return dt
  } catch {
    return null
  }
}
