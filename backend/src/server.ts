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
  const meetingId = String(request.body?.meetingId ?? '');
  const question = String(request.body?.question ?? '');
  const transcript = Array.isArray(request.body?.transcript) ? request.body.transcript : [];
  const actionItems = Array.isArray(request.body?.actionItems) ? request.body.actionItems : [];

  if (!question.trim()) {
    response.status(400).json({ error: 'Question is required.' });
    return;
  }

  const normalized = question.toLowerCase();

  if (normalized.includes('who') && normalized.includes('pricing')) {
    response.json({
      answer:
        'Sarah mentioned pricing and suggested revisiting enterprise-tier pricing before Q3 execution.',
      timestamp: '00:14:32'
    });
    return;
  }

  if (normalized.includes('action')) {
    const summarized = actionItems
      .slice(0, 3)
      .map((item: { assignee?: string; task?: string }) => `@${item.assignee ?? 'Owner'}: ${item.task ?? 'Task'}`)
      .join('; ');

    response.json({
      answer:
        summarized.length > 0
          ? `Action items detected: ${summarized}.`
          : 'Action items include finalizing tech specs and updating help center articles.',
      timestamp: actionItems[0]?.timestamp ?? '00:18:45'
    });
    return;
  }

  if (normalized.includes('disagree') || normalized.includes('timeline')) {
    const disagreement = transcript.find((line: { text?: string }) => {
      const content = String(line.text ?? '').toLowerCase();
      return content.includes('disagree') || content.includes('timeline') || content.includes('concern');
    });

    response.json({
      answer:
        disagreement?.text ??
        'Sarah raised concerns about the timeline and requested a safer rollout window.',
      timestamp: disagreement?.timestamp ?? '00:02:20'
    });
    return;
  }

  response.json({
    answer:
      meetingId === 'meeting-1'
        ? 'The Product Sync discussion focused on Q3 priorities, Dark Mode launch alignment, and API latency risk management.'
        : 'The meeting focused on priorities, ownership decisions, and concrete follow-up actions.',
    timestamp: '00:01:02'
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
