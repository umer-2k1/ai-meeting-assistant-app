import prisma from '../src/lib/prisma.js';

/**
 * Seed database with initial data
 */
async function seed() {
  console.log('🌱 Seeding database...');

  // Create a demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      timezone: 'America/New_York',
      language: 'en',
    },
  });

  console.log('✅ Demo user created:', demoUser.email);

  // Create sample meeting
  const meeting = await prisma.meeting.create({
    data: {
      title: 'Product Planning Session',
      description: 'Quarterly planning for Q2 2026',
      startTime: new Date('2026-05-20T10:00:00Z'),
      endTime: new Date('2026-05-20T11:30:00Z'),
      duration: 5400,
      status: 'COMPLETED',
      platform: 'zoom',
      aiSummary: 'Team discussed Q2 priorities and resource allocation.',
      userId: demoUser.id,
      attendees: {
        create: [
          {
            name: 'John Martinez',
            email: 'john@example.com',
            role: 'organizer',
          },
          {
            name: 'Sarah Chen',
            email: 'sarah@example.com',
            role: 'required',
          },
        ],
      },
      transcript: {
        create: [
          {
            speaker: 'John Martinez',
            text: "Let's start by reviewing our Q2 goals.",
            timestamp: '00:00:15',
            timestampSeconds: 15,
            confidence: 0.95,
          },
          {
            speaker: 'Sarah Chen',
            text: 'I think we should prioritize the mobile app launch.',
            timestamp: '00:00:45',
            timestampSeconds: 45,
            confidence: 0.92,
          },
        ],
      },
      actionItems: {
        create: [
          {
            task: 'Finalize mobile app wireframes',
            assignee: 'Sarah Chen',
            priority: 'HIGH',
            status: 'PENDING',
            dueDate: new Date('2026-05-27T23:59:59Z'),
          },
        ],
      },
      tags: {
        create: [
          { name: 'planning', color: '#3B82F6' },
          { name: 'product', color: '#10B981' },
        ],
      },
    },
  });

  console.log('✅ Sample meeting created:', meeting.title);

  console.log('🎉 Seeding completed!');
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    // Avoid importing Node builtins just for typing; still exit in Node.
    (globalThis as any).process?.exit?.(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
