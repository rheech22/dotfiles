import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises"
import { basename, extname, join, resolve } from "path"
import { runTranscriptPipeline, type PipelineHarnessResult } from "../src/harness"
import type { ExistingDoc } from "../src/types"

export type FixtureExpectation = {
  expectedDecision?: "skip" | "proceed"
  expectedDocType?: "reference" | "explanation"
  mustInclude?: string[]
  mustAvoid?: string[]
}

export type RunnerOptions = {
  transcriptPath: string
  expectationPath?: string
  existingDocsPath?: string
  today?: string
  saveArtifact?: boolean
  artifactDir?: string
  json?: boolean
  verbose?: boolean
}

export type ExpectationFailure = {
  kind: "decision" | "docType" | "mustInclude" | "mustAvoid"
  message: string
}

export type RunnerResult = {
  fixtureName: string
  transcriptPath: string
  expectationPath?: string
  existingDocsPath?: string
  expectation: FixtureExpectation | null
  pipeline: PipelineHarnessResult
  failures: ExpectationFailure[]
  artifactPath?: string
}

export const RUNNER_USAGE = `Usage:
  npm run test:pipeline -- <transcript.md> [--expectation file.expect.json] [--existing-docs docs.json] [--today YYYY-MM-DD] [--save-artifact] [--artifact-dir dir] [--json] [--verbose]
  npm run test:pipeline:batch -- [fixtures-dir] [--save-artifact] [--artifact-dir dir] [--json] [--verbose]`

export function parseArgs(argv: string[]): RunnerOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    throw new Error(RUNNER_USAGE)
  }

  const options: RunnerOptions = {
    transcriptPath: "",
    artifactDir: "artifacts",
    saveArtifact: false,
    json: false,
    verbose: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith("--")) {
      if (!options.transcriptPath) {
        options.transcriptPath = value
        continue
      }
      throw new Error(`unexpected positional argument: ${value}`)
    }

    if (value === "--save-artifact") {
      options.saveArtifact = true
      continue
    }
    if (value === "--json") {
      options.json = true
      continue
    }
    if (value === "--verbose") {
      options.verbose = true
      continue
    }

    const next = argv[index + 1]
    if (!next) throw new Error(`missing value for ${value}`)

    if (value === "--expectation") options.expectationPath = next
    else if (value === "--existing-docs") options.existingDocsPath = next
    else if (value === "--today") options.today = next
    else if (value === "--artifact-dir") options.artifactDir = next
    else throw new Error(`unknown option: ${value}`)

    index += 1
  }

  if (!options.transcriptPath) throw new Error("transcript path is required")
  return options
}

export function fixtureNameFromPath(filePath: string): string {
  return basename(filePath, extname(filePath))
}

function isTranscriptFixtureFile(fileName: string): boolean {
  if (!(fileName.endsWith(".md") || fileName.endsWith(".txt"))) return false
  return fileName.toLowerCase() !== "readme.md"
}

export function defaultExpectationPath(transcriptPath: string): string {
  const extension = extname(transcriptPath)
  return transcriptPath.slice(0, -extension.length) + ".expect.json"
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8")
  return JSON.parse(raw) as T
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf-8")
    return true
  } catch {
    return false
  }
}

export async function resolveExpectation(pathFromOption: string | undefined, transcriptPath: string): Promise<{
  expectation: FixtureExpectation | null
  expectationPath?: string
}> {
  const explicitPath = pathFromOption ? resolve(pathFromOption) : undefined
  if (explicitPath) {
    return {
      expectation: await readJsonFile<FixtureExpectation>(explicitPath),
      expectationPath: explicitPath,
    }
  }

  const inferredPath = resolve(defaultExpectationPath(transcriptPath))
  if (!(await pathExists(inferredPath))) {
    return { expectation: null }
  }

  return {
    expectation: await readJsonFile<FixtureExpectation>(inferredPath),
    expectationPath: inferredPath,
  }
}

export async function resolveExistingDocs(filePath: string | undefined): Promise<{
  existingDocs: ExistingDoc[]
  existingDocsPath?: string
}> {
  if (!filePath) return { existingDocs: [] }
  const resolvedPath = resolve(filePath)
  return {
    existingDocs: await readJsonFile<ExistingDoc[]>(resolvedPath),
    existingDocsPath: resolvedPath,
  }
}

export function evaluateExpectation(
  result: PipelineHarnessResult,
  expectation: FixtureExpectation | null,
): ExpectationFailure[] {
  if (!expectation) return []

  const failures: ExpectationFailure[] = []
  if (expectation.expectedDecision && result.classification.decision !== expectation.expectedDecision) {
    failures.push({
      kind: "decision",
      message: `expected decision=${expectation.expectedDecision}, got ${result.classification.decision}`,
    })
  }

  if (expectation.expectedDocType && result.classification.docType !== expectation.expectedDocType) {
    failures.push({
      kind: "docType",
      message: `expected docType=${expectation.expectedDocType}, got ${result.classification.docType ?? "(none)"}`,
    })
  }

  const markdown = result.summary?.markdown ?? ""
  for (const token of expectation.mustInclude ?? []) {
    if (!markdown.includes(token)) {
      failures.push({
        kind: "mustInclude",
        message: `summary should include: ${token}`,
      })
    }
  }

  for (const token of expectation.mustAvoid ?? []) {
    if (markdown.includes(token)) {
      failures.push({
        kind: "mustAvoid",
        message: `summary should avoid: ${token}`,
      })
    }
  }

  return failures
}

export async function runFixture(options: RunnerOptions): Promise<RunnerResult> {
  const transcriptPath = resolve(options.transcriptPath)
  const transcript = await readFile(transcriptPath, "utf-8")
  const fixtureName = fixtureNameFromPath(transcriptPath)
  const { expectation, expectationPath } = await resolveExpectation(options.expectationPath, transcriptPath)
  const { existingDocs, existingDocsPath } = await resolveExistingDocs(options.existingDocsPath)

  const pipeline = await runTranscriptPipeline({
    transcript,
    existingDocs,
    today: options.today,
  })
  const failures = evaluateExpectation(pipeline, expectation)

  let artifactPath: string | undefined
  if (options.saveArtifact) {
    const artifactDir = resolve(options.artifactDir ?? "artifacts")
    await mkdir(artifactDir, { recursive: true })
    artifactPath = join(artifactDir, `${fixtureName}.result.json`)
    await writeFile(
      artifactPath,
      JSON.stringify(
        {
          fixtureName,
          transcriptPath,
          expectationPath,
          existingDocsPath,
          expectation,
          pipeline,
          failures,
        },
        null,
        2,
      ),
      "utf-8",
    )
  }

  return {
    fixtureName,
    transcriptPath,
    expectationPath,
    existingDocsPath,
    expectation,
    pipeline,
    failures,
    artifactPath,
  }
}

export function printRunnerResult(result: RunnerResult, options: Pick<RunnerOptions, "json" | "verbose">): void {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  const { classification, summary } = result.pipeline
  const lines = [
    `fixture: ${result.fixtureName}`,
    `decision: ${classification.decision}`,
    `narrowTopic: ${classification.narrowTopic ?? ""}`,
    `docType: ${classification.docType ?? ""}`,
    `summaryAction: ${summary?.action ?? "skip"}`,
    `title: ${summary?.title ?? ""}`,
    `tags: ${(summary?.tags ?? []).join(", ")}`,
    `expectation: ${result.failures.length === 0 ? "pass" : "fail"}`,
  ]

  if (result.artifactPath) lines.push(`artifact: ${result.artifactPath}`)
  if (result.failures.length > 0) {
    lines.push("failures:")
    for (const failure of result.failures) lines.push(`- ${failure.message}`)
  }

  if (options.verbose && summary?.markdown) {
    lines.push("markdown:")
    lines.push(summary.markdown)
  }

  process.stdout.write(`${lines.join("\n")}\n`)
}

export async function collectTranscriptPaths(inputPath: string): Promise<string[]> {
  const resolvedPath = resolve(inputPath)
  const resolvedStat = await stat(resolvedPath)
  if (resolvedStat.isDirectory()) {
    const entries = await readdir(resolvedPath, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && isTranscriptFixtureFile(entry.name))
      .map((entry) => join(resolvedPath, entry.name))
      .sort()
  }
  return [resolvedPath]
}
