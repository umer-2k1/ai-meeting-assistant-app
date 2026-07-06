/**
 * Startup environment validation.
 *
 * The app requires real service credentials to function (see NEW_REQUIREMENT.md
 * tech stack). Rather than silently degrading into mock behaviour, we fail fast
 * at boot with a clear, actionable list of what is missing.
 */

interface RequiredVar {
  name: string;
  hint: string;
}

/** Vars that have no safe default and gate a core capability. */
const REQUIRED_VARS: RequiredVar[] = [
  { name: 'DATABASE_URL', hint: 'SQLite path, e.g. file:./dev.db' },
  { name: 'JWT_SECRET', hint: 'random secret for signing session JWTs' },
  { name: 'SESSION_SECRET', hint: 'random secret for express-session' },
  { name: 'GOOGLE_CLIENT_ID', hint: 'Google OAuth client id (login + calendar/gmail)' },
  { name: 'GOOGLE_CLIENT_SECRET', hint: 'Google OAuth client secret' },
  { name: 'GROQ_API_KEY', hint: 'Groq LLM API key (summaries, action items, chat)' },
  { name: 'GOOGLE_GEMINI_API_KEY', hint: 'Gemini embeddings API key (RAG)' },
  { name: 'DEEPGRAM_API_KEY', hint: 'Deepgram API key (live transcription)' },
  { name: 'QDRANT_URL', hint: 'Qdrant vector DB URL, e.g. http://localhost:6333' },
  { name: 'CLOUDINARY_CLOUD_NAME', hint: 'Cloudinary cloud name (audio/exports)' },
  { name: 'CLOUDINARY_API_KEY', hint: 'Cloudinary API key' },
  { name: 'CLOUDINARY_API_SECRET', hint: 'Cloudinary API secret' },
];

/**
 * Vars that have localhost defaults for development but MUST be set explicitly
 * in production — OAuth redirects and deep links silently break otherwise.
 */
const PRODUCTION_REQUIRED_VARS: RequiredVar[] = [
  { name: 'FRONTEND_URL', hint: 'public URL of the frontend (OAuth redirect target)' },
  { name: 'GOOGLE_REDIRECT_URI', hint: 'public login OAuth callback, e.g. https://api.example.com/auth/google/callback' },
];

/** Returns the list of missing required env vars (empty when all present). */
export function getMissingEnvVars(): RequiredVar[] {
  const required =
    process.env.NODE_ENV === 'production'
      ? [...REQUIRED_VARS, ...PRODUCTION_REQUIRED_VARS]
      : REQUIRED_VARS;
  return required.filter(({ name }) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });
}

/**
 * Validate required env vars; if any are missing, print a clear report and
 * exit the process. Call once at startup before binding the server.
 */
export function validateEnvOrExit(): void {
  const missing = getMissingEnvVars();
  if (missing.length === 0) return;

  console.error(
    '\n❌ Cannot start: missing required environment variables.\n' +
      '   Copy backend/.env.example to backend/.env and fill in the values below.\n'
  );
  for (const { name, hint } of missing) {
    console.error(`   - ${name}  (${hint})`);
  }
  console.error('');
  process.exit(1);
}
