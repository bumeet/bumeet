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
    const message = await this.prisma.messageToDisplay.create({
      data: { userId, content, status: 'pending', permanent },
    });

    // Permanent messages stay until explicitly cancelled — no auto-delivery simulation
    if (!permanent) {
      setTimeout(async () => {
        await this.prisma.messageToDisplay.update({
          where: { id: message.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      }, 2000);

      setTimeout(async () => {
        await this.prisma.messageToDisplay.update({
          where: { id: message.id },
          data: { status: 'delivered', deliveredAt: new Date() },
        });
      }, 7000);
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

    // Regular pending messages (agent-visible, excludes auto-status)
    return this.prisma.messageToDisplay.findFirst({
      where: {
        userId,
        status: { in: ['pending', 'sent'] },
        NOT: [
          { content: { startsWith: 'BUSY' } },
          { content: { equals: 'FREE' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
