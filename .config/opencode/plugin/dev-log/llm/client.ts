import OpenAI from "openai"
import { API_KEY } from "../config"

export const llmClient = new OpenAI({ apiKey: API_KEY, baseURL: "https://api.synthetic.new/openai/v1" })

export function hasApiKey(): boolean {
  return Boolean(API_KEY)
}
