import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await argon2.hash('Demo1234!');

  const user = await prisma.user.upsert({
    where: { email: 'demo@bumeet.io' },
    update: {},
    create: {
      email: 'demo@bumeet.io',
      name: 'Demo User',
      passwordHash,
      timezone: 'Europe/Madrid',
      language: 'en',
    },
  });

  console.log('Created user:', user.email);

  const googleIntegration = await prisma.integrationAccount.upsert({
    where: { userId_provider_providerAccountId: { userId: user.id, provider: 'google', providerAccountId: 'demo-google-account' } },
    update: {},
    create: {
      userId: user.id,
      provider: 'google',
      providerAccountId: 'demo-google-account',
      label: 'demo@gmail.com',
      status: 'active',
      lastSyncAt: new Date(),
      eventsImported: 42,
    },
  });

  const msIntegration = await prisma.integrationAccount.upsert({
    where: { userId_provider_providerAccountId: { userId: user.id, provider: 'microsoft', providerAccountId: 'demo-microsoft-account' } },
    update: {},
    create: {
      userId: user.id,
      provider: 'microsoft',
      providerAccountId: 'demo-microsoft-account',
      label: 'demo@outlook.com',
      status: 'active',
      lastSyncAt: new Date(Date.now() - 1000 * 60 * 30),
      eventsImported: 28,
    },
  });

  console.log('Created integrations');

  const now = new Date();
  const events = [
    {
      integrationId: googleIntegration.id,
      externalId: 'g-event-1',
      title: 'Team Standup',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30),
      location: 'Google Meet',
    },
    {
      integrationId: googleIntegration.id,
      externalId: 'g-event-2',
      title: 'Product Review',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0),
      description: 'Weekly product review meeting',
    },
    {
      integrationId: msIntegration.id,
      externalId: 'ms-event-1',
      title: 'Engineering Sync',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0),
      location: 'Teams',
    },
    {
      integrationId: msIntegration.id,
      externalId: 'ms-event-2',
      title: 'Design Review',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 15, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 16, 30),
    },
    {
      integrationId: googleIntegration.id,
      externalId: 'g-event-3',
      title: '1:1 with Manager',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 30),
    },
  ];

  for (const event of events) {
    await prisma.calendarEvent.upsert({
      where: { integrationId_externalId: { integrationId: event.integrationId, externalId: event.externalId } },
      update: {},
      create: { userId: user.id, ...event },
    });
  }

  console.log('Created calendar events');

  const messages = [
    { content: 'In a meeting — back at 3pm', status: 'delivered', sentAt: new Date(Date.now() - 3600000), deliveredAt: new Date(Date.now() - 3595000) },
    { content: 'Do not disturb', status: 'sent', sentAt: new Date(Date.now() - 1800000) },
    { content: 'Working from home today', status: 'error', errorMsg: 'Display offline' },
  ];

  for (const [i, msg] of messages.entries()) {
    await prisma.messageToDisplay.upsert({
      where: { id: `seed-msg-${i}` },
      update: {},
      create: { id: `seed-msg-${i}`, userId: user.id, ...msg },
    });
  }

  console.log('Created messages');
  console.log('Seed complete! Demo credentials: demo@bumeet.io / Demo1234!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
