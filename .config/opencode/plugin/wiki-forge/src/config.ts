import { readFileSync } from "fs"
import { homedir } from "os"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

type WikiForgeConfig = {
  outputDir?: string
}

function loadConfig(): WikiForgeConfig {
  const configPath = join(dirname(fileURLToPath(import.meta.url)), "..", "wiki-forge.config.json")
  try {
    const raw = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(raw) as WikiForgeConfig
    if (!parsed || typeof parsed !== "object") return {}
    return parsed
  } catch {
    return {}
  }
}

const runtimeConfig = loadConfig()
const DEFAULT_WORK_DIR = join(homedir(), "wiki-forge")

export const OUTPUT_DIR = typeof runtimeConfig.outputDir === "string" && runtimeConfig.outputDir.trim()
  ? runtimeConfig.outputDir.trim()
  : DEFAULT_WORK_DIR
export const LOG_DIR = DEFAULT_WORK_DIR
export const TRACE_LOG = join(LOG_DIR, "wiki-forge.trace.log")

export const API_KEY = process.env.SYNTHETIC_API_KEY ?? ""
export const CLASSIFIER_MODEL = "hf:deepseek-ai/DeepSeek-V3.2"
export const MODEL = "hf:deepseek-ai/DeepSeek-V3.2"
export const REVIEWER_MODEL = "hf:deepseek-ai/DeepSeek-V3.2"
export const MAX_MESSAGES = 60
export const MAX_TRANSCRIPT_CHARS = 12000
