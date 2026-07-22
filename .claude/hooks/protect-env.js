#!/usr/bin/env node

/**
 * Claude Code Hook: Protect .env files
 *
 * This script runs BEFORE Claude uses any Read or Grep tool.
 * If Claude is trying to access a .env file, we block it by
 * exiting with code 2 and printing an error message.
 */

async function main() {
  // Step 1: Read the tool call data that Claude Code sends us via stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  // Step 2: Parse it from JSON
  const toolData = JSON.parse(Buffer.concat(chunks).toString());

  // Step 3: Find the file path Claude is trying to access
  // (Different tools use different field names — we check both)
  const filePath =
    toolData.tool_input?.file_path || toolData.tool_input?.path || "";

  // Step 4: Check if the path includes ".env"
  // This catches: .env, .env.local, .env.production, etc.
  if (filePath.includes(".env")) {
    // Print an error message (Claude will see this)
    console.error(
      `[Security Hook] Blocked: Claude attempted to read "${filePath}". ` +
        `Access to .env files is not allowed.`,
    );

    // Exit code 2 = block the tool call
    process.exit(2);
  }

  // If we reach here, the file is allowed — exit normally
  process.exit(0);
}

main().catch((err) => {
  console.error("[Security Hook] Unexpected error:", err.message);
  process.exit(1); // Exit code 1 = log an error, but don't block
});
