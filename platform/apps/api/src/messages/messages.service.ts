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

  async create(userId: string, content: string) {
    const message = await this.prisma.messageToDisplay.create({
      data: { userId, content, status: 'pending' },
    });

    // Simulate delivery
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

    return message;
  }

  async findById(userId: string, id: string) {
    const message = await this.prisma.messageToDisplay.findFirst({
      where: { id, userId },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }
}
