import cors from 'cors';
import express from 'express';

import { sampleMeetings, sampleTranscript } from './data.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'ai-meeting-copilot-backend' });
});

app.get('/api/meetings', (_request, response) => {
  response.json({ meetings: sampleMeetings });
});

app.get('/api/meetings/:meetingId/transcript', (request, response) => {
  const meeting = sampleMeetings.find((entry) => entry.id === request.params.meetingId);
  if (!meeting) {
    response.status(404).json({ error: 'Meeting not found' });
    return;
  }

  response.json({
    meetingId: meeting.id,
    transcript: sampleTranscript
  });
});

app.post('/api/ask-meeting', (request, response) => {
  const question = String(request.body?.question ?? '');
  const normalized = question.toLowerCase();

  if (normalized.includes('action')) {
    response.json({
      answer: 'Action items include finalizing tech specs and updating help center articles.',
      timestamp: '00:18:45'
    });
    return;
  }

  response.json({
    answer: 'The meeting focused on Q3 priorities and API latency risk management.',
    timestamp: '00:01:02'
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
