import { access, readdir, readFile, rename, writeFile } from "fs/promises"
import { basename, dirname, join } from "path"
import { OUTPUT_DIR } from "../config"
import type { ExistingDoc } from "../types"

const DEFAULT_INDEX = `## Literature Notes

### Miscellaneous

---

### Meta
- [[tag-index|태그 인덱스]]
- [[tag-relationships|태그 관계도]]
`

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildIndexLink(filename: string, title: string): string {
  return `- [[${filename}|${title}]]`
}

function insertIntoMiscellaneous(content: string, link: string): string {
  const lines = content.split("\n")
  const sectionIndex = lines.findIndex((line) => line.trim() === "### Miscellaneous")

  if (sectionIndex >= 0) {
    let endIndex = lines.length
    for (let i = sectionIndex + 1; i < lines.length; i += 1) {
      const trimmed = lines[i].trim()
      if (trimmed.startsWith("### ") || trimmed === "---") {
        endIndex = i
        break
      }
    }

    let insertAt = endIndex
    while (insertAt > sectionIndex + 1 && lines[insertAt - 1].trim() === "") insertAt -= 1
    lines.splice(insertAt, 0, link, "")
    return lines.join("\n")
  }

  const dividerIndex = lines.findIndex((line) => line.trim() === "---")
  const sectionLines = ["### Miscellaneous", "", link, ""]
  if (dividerIndex >= 0) {
    lines.splice(dividerIndex, 0, ...sectionLines)
    return lines.join("\n")
  }

  const prefix = content.trimEnd()
  return `${prefix}\n\n${sectionLines.join("\n")}`
}

export function toDocumentPath(filename: string): string {
  return join(OUTPUT_DIR, `${filename}.md`)
}

export async function readExistingDocs(filename: string): Promise<ExistingDoc[]> {
  const path = toDocumentPath(filename)
  try {
    return [{ path, content: await readFile(path, "utf-8") }]
  } catch {
    return []
  }
}

export function toFileSlug(text: string): string {
  const normalized = text
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/^-|-$/g, "")
  return normalized || "session"
}

export async function writeMarkdown(path: string, markdown: string): Promise<void> {
  const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`)
  await writeFile(tempPath, markdown, "utf-8")
  await rename(tempPath, path)
}

export async function findDuplicateDocumentPaths(path: string): Promise<string[]> {
  const directory = dirname(path)
  const filename = basename(path, ".md")
  const duplicatePattern = new RegExp(`^${escapeRegExp(filename)} \(\\d+\)\\.md$`)

  try {
    const files = await readdir(directory)
    return files.filter((file) => duplicatePattern.test(file)).map((file) => join(directory, file))
  } catch {
    return []
  }
}

export async function ensureIndexEntry(docPath: string, title: string): Promise<void> {
  const indexPath = join(OUTPUT_DIR, "index.md")
  const filename = basename(docPath, ".md")
  const linkPattern = new RegExp(`\\[\\[${escapeRegExp(filename)}(?:\\|[^\\]]+)?\\]\\]`)

  let content = DEFAULT_INDEX
  try {
    await access(indexPath)
    content = await readFile(indexPath, "utf-8")
  } catch {
    // Use the minimal index skeleton when the target folder has no index yet.
  }

  if (linkPattern.test(content)) return
  const updated = insertIntoMiscellaneous(content, buildIndexLink(filename, title))
  await writeMarkdown(indexPath, `${updated.trimEnd()}\n`)
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
