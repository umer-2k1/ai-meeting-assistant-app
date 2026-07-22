const config = {
  metadata: {
    title: 'AI Meeting Copilot',
    description:
      'Desktop-first AI meeting assistant with live transcription, intelligent summaries, action items, and meeting follow-up workflows.',
    keywords:
      'ai meeting copilot, transcription, meeting intelligence, action items, dashboard, react, tailwind, shadcn'
  },
  server: {
    // '::' binds the dual-stack wildcard: BOTH [::1] and 127.0.0.1. With plain
    // 'localhost', Node picks one stack (usually IPv6-only), leaving the IPv4
    // side of port 3000 free for any other dev server to claim. That exact
    // split happened in practice — another project's Next.js server answered
    // 127.0.0.1:3000 while Vite held [::1]:3000, so Electron's widget window
    // randomly loaded a foreign app as an opaque page ("black screen" bug).
    host: '::',
    port: 3000
  }
} as const;

export default config;
