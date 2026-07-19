#!/usr/bin/env node

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const toolData = JSON.parse(Buffer.concat(chunks).toString());

  // For Bash tool, the field is "command" not "file_path"
  const command = toolData.tool_input?.command || "";

  // Block if the bash command references .env
  if (command.includes(".env")) {
    console.error(
      `[Security Hook] Blocked Bash command referencing .env: "${command}"`,
    );
    process.exit(2);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[Security Hook] Error:", err.message);
  process.exit(1);
});
