/**
 * Robust JSON extraction + validation for LLM outputs.
 *
 * LLMs frequently wrap JSON in ```json fences or add prose. These helpers strip
 * that, validate the result against a zod schema, and retry the call once before
 * giving up — so callers never silently swallow a malformed response.
 */
import type { z } from 'zod';

/** Pull the most likely JSON object/array substring out of raw LLM text. */
export function extractJsonBlock(raw: string): string {
  let s = raw.trim();

  // Strip a ```json ... ``` (or ``` ... ```) fence if present.
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence?.[1]) s = fence[1].trim();

  // Narrow to the first {...} or [...] span.
  const firstObj = s.indexOf('{');
  const firstArr = s.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start === -1) return s;

  const isArray = s[start] === '[';
  const end = isArray ? s.lastIndexOf(']') : s.lastIndexOf('}');
  return end > start ? s.slice(start, end + 1) : s;
}

/**
 * Escape raw control characters (newlines/tabs/CRs) that appear *inside* JSON
 * string values. LLMs asked for multi-paragraph text routinely emit literal
 * newlines inside a string, which is invalid JSON — this repairs that without
 * touching structural whitespace, preserving paragraph breaks as \n.
 */
function escapeControlCharsInStrings(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
    }
    out += ch;
  }
  return out;
}

/** Parse + validate LLM JSON output against a schema (throws on failure). */
export function parseLlmJson<S extends z.ZodTypeAny>(raw: string, schema: S): z.infer<S> {
  const block = extractJsonBlock(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    // Retry after repairing raw control chars inside string values.
    parsed = JSON.parse(escapeControlCharsInStrings(block));
  }
  return schema.parse(parsed) as z.infer<S>;
}

/**
 * Invoke an LLM chain and parse/validate its JSON output, retrying once on
 * parse/validation failure. Throws if both attempts fail.
 */
export async function invokeJson<S extends z.ZodTypeAny>(
  invoke: () => Promise<string>,
  schema: S,
  label: string
): Promise<z.infer<S>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await invoke();
    try {
      return parseLlmJson(raw, schema);
    } catch (error) {
      lastError = error;
      console.warn(`[llm-json] ${label} parse failed (attempt ${attempt + 1}/2)`);
    }
  }
  throw new Error(
    `LLM did not return valid JSON for ${label}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
