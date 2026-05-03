import { writeFile } from "fs/promises"
import { join } from "path"
import { PENDING_DIR } from "./config"
import { withRetry } from "./utils"

export async function uploadWithPending($: any, outPath: string, shortId: string): Promise<string | null> {
  try {
    await withRetry(() => $`rclone copy ${outPath} gdrive:dev-logs/ --no-update-modtime`)
    return null
  } catch {
    const pendingPath = join(PENDING_DIR, `${Date.now()}-${shortId}.pending`)
    await writeFile(pendingPath, outPath, "utf-8")
    return pendingPath
  }
}
