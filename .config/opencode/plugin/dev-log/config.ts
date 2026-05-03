import { homedir } from "os"
import { join } from "path"

export const LOG_DIR = join(homedir(), "dev-logs")
export const PENDING_DIR = join(LOG_DIR, ".pending")
export const TRACE_LOG = join(LOG_DIR, "dev-log.trace.log")

export const API_KEY = process.env.SYNTHETIC_API_KEY ?? ""
export const MODEL = "hf:deepseek-ai/DeepSeek-V3.2"
export const MAX_MESSAGES = 60
export const MAX_TRANSCRIPT_CHARS = 12000
