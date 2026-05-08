import { randomUUID } from "crypto"
import { Client } from "langsmith"
import { RunTree } from "langsmith/run_trees"
import { writeTrace } from "./logger"

type KV = Record<string, unknown>

const DEFAULT_LANGSMITH_ENDPOINT = "https://api.smith.langchain.com"
const DEFAULT_LANGSMITH_PROJECT = "wiki-forge"

export type TraceRun = {
  runId: string
  traceId: string
  runTree: RunTree
}

class NoopTracer {
  enabled = false

  async startRun(_name: string, _runType: string, _inputs: KV, _parent?: TraceRun): Promise<TraceRun | null> {
    return null
  }

  async endRun(_run: TraceRun | null, _payload: { outputs?: KV; error?: string; extra?: KV }): Promise<void> {
    // noop
  }
}

class LangSmithTracer {
  enabled = true
  private client: Client
  private projectName: string

  constructor() {
    this.client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: process.env.LANGSMITH_ENDPOINT ?? DEFAULT_LANGSMITH_ENDPOINT,
    })
    this.projectName = process.env.LANGSMITH_PROJECT ?? DEFAULT_LANGSMITH_PROJECT
  }

  async startRun(name: string, runType: string, inputs: KV, parent?: TraceRun): Promise<TraceRun | null> {
    const runId = randomUUID()
    try {
      if (parent?.runTree) {
        const child = parent.runTree.createChild({
          id: runId,
          name,
          run_type: runType,
          inputs,
          project_name: this.projectName,
          start_time: Date.now(),
        })
        await child.postRun()
        return { runId: child.id, traceId: child.trace_id, runTree: child }
      }

      const root = new RunTree({
        id: runId,
        name,
        run_type: runType,
        project_name: this.projectName,
        client: this.client,
        inputs,
        start_time: Date.now(),
      })
      await root.postRun()
      return { runId: root.id, traceId: root.trace_id, runTree: root }
    } catch (error) {
      await writeTrace(`langsmith start failed name=${name} err=${error instanceof Error ? error.message : "unknown"}`)
      return null
    }
  }

  async endRun(run: TraceRun | null, payload: { outputs?: KV; error?: string; extra?: KV }): Promise<void> {
    if (!run) return
    try {
      const mergedExtra = payload.extra
        ? { ...(run.runTree.extra ?? {}), ...payload.extra }
        : run.runTree.extra
      run.runTree.extra = mergedExtra ?? {}
      await run.runTree.end(payload.outputs, payload.error, Date.now())
      await run.runTree.patchRun()
    } catch (error) {
      await writeTrace(`langsmith end failed run=${run.runId} err=${error instanceof Error ? error.message : "unknown"}`)
    }
  }
}

function buildTracer() {
  const enabled = Boolean(process.env.LANGSMITH_API_KEY)
  return enabled ? new LangSmithTracer() : new NoopTracer()
}

export const tracer = buildTracer()
