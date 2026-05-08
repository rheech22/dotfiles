import { collectTranscriptPaths, parseArgs, printRunnerResult, runFixture, RUNNER_USAGE } from "./lib"

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const transcriptPaths = await collectTranscriptPaths(options.transcriptPath)
  let failureCount = 0

  for (const transcriptPath of transcriptPaths) {
    const result = await runFixture({
      ...options,
      transcriptPath,
    })
    printRunnerResult(result, options)
    process.stdout.write("\n")
    if (result.failures.length > 0) failureCount += 1
  }

  if (failureCount > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const isUsage = message === RUNNER_USAGE
  const out = isUsage ? process.stdout : process.stderr
  out.write(`${message}\n`)
  process.exitCode = isUsage ? 0 : 1
})
