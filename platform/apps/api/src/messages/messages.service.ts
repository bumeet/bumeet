import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string) {
    return this.prisma.messageToDisplay.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async create(userId: string, content: string, permanent = false) {
    // Only one custom message is active at a time. Supersede any previous active
    // custom messages (newest wins) so that cancelling the current one returns the
    // display to auto presence instead of resurfacing an older message.
    await this.prisma.messageToDisplay.updateMany({
      where: {
        userId,
        status: { in: ['pending', 'sent', 'delivered'] },
        NOT: [{ content: { startsWith: 'BUSY' } }, { content: { equals: 'FREE' } }],
      },
      data: { status: 'cancelled' },
    });

    const message = await this.prisma.messageToDisplay.create({
      data: { userId, content, status: 'pending', permanent },
    });

    // Permanent messages stay until explicitly cancelled — no auto-delivery simulation.
    // NOTE: this in-process setTimeout simulation is best-effort only — it is lost on
    // restart and does not span instances. A durable job (BullMQ on the existing
    // ioredis) should replace it; for now we re-read status so a cancel isn't
    // overwritten, and swallow errors so a dropped DB connection can't crash the process.
    if (!permanent) {
      const advance = async (status: 'sent' | 'delivered', stamp: 'sentAt' | 'deliveredAt') => {
        try {
          const current = await this.prisma.messageToDisplay.findUnique({
            where: { id: message.id },
          });
          if (!current || current.status === 'cancelled') return;
          await this.prisma.messageToDisplay.update({
            where: { id: message.id },
            data: { status, [stamp]: new Date() },
          });
        } catch {
          /* best-effort simulation — ignore */
        }
      };
      setTimeout(() => void advance('sent', 'sentAt'), 2000);
      setTimeout(() => void advance('delivered', 'deliveredAt'), 7000);
    }

    return message;
  }

  async findById(userId: string, id: string) {
    const message = await this.prisma.messageToDisplay.findFirst({
      where: { id, userId },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async markDelivered(userId: string, id: string) {
    const message = await this.prisma.messageToDisplay.findFirst({
      where: { id, userId },
    });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.messageToDisplay.update({
      where: { id },
      data: { status: 'delivered', deliveredAt: new Date(), sentAt: message.sentAt ?? new Date() },
    });
  }

  async cancelMessage(userId: string, id: string) {
    const message = await this.prisma.messageToDisplay.findFirst({
      where: { id, userId },
    });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.messageToDisplay.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async getLatestPending(userId: string) {
    // Permanent messages take priority — returned even after being marked delivered
    const permanent = await this.prisma.messageToDisplay.findFirst({
      where: {
        userId,
        permanent: true,
        status: { not: 'cancelled' },
        NOT: [
          { content: { startsWith: 'BUSY' } },
          { content: { equals: 'FREE' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (permanent) return permanent;

    // Latest active custom message (agent-visible, excludes auto-status). Includes
    // 'delivered' so the message STAYS on the display after the delivery simulation
    // completes — it persists until the user sends a new one or cancels it. Without
    // this, the message vanished ~7 s after sending (once marked delivered).
    return this.prisma.messageToDisplay.findFirst({
      where: {
        userId,
        status: { in: ['pending', 'sent', 'delivered'] },
        NOT: [
          { content: { startsWith: 'BUSY' } },
          { content: { equals: 'FREE' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
