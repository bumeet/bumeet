import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  messageToDisplay: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('create returns a message with pending status', async () => {
    const mockMessage = { id: '1', userId: 'user1', content: 'Hello', status: 'pending', createdAt: new Date() };
    mockPrisma.messageToDisplay.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.messageToDisplay.create.mockResolvedValue(mockMessage);
    mockPrisma.messageToDisplay.update.mockResolvedValue({ ...mockMessage, status: 'sent' });

    const result = await service.create('user1', 'Hello');
    expect(result.status).toBe('pending');
    expect(result.content).toBe('Hello');
  });

  it('create supersedes previous active custom messages so only the newest stays', async () => {
    mockPrisma.messageToDisplay.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.messageToDisplay.create.mockResolvedValue({
      id: '2', userId: 'user1', content: 'En reunión', status: 'pending', createdAt: new Date(),
    });

    await service.create('user1', 'En reunión');

    expect(mockPrisma.messageToDisplay.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user1',
          status: { in: ['pending', 'sent', 'delivered'] },
        }),
        data: { status: 'cancelled' },
      }),
    );
  });

  it('getLatestPending returns delivered custom messages so they persist on the display', async () => {
    mockPrisma.messageToDisplay.findFirst
      .mockResolvedValueOnce(null) // no permanent message
      .mockResolvedValueOnce({ id: '3', content: 'En reunión', status: 'delivered' });

    const result = await service.getLatestPending('user1');

    expect(result).toMatchObject({ content: 'En reunión', status: 'delivered' });
    expect(mockPrisma.messageToDisplay.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['pending', 'sent', 'delivered'] },
        }),
      }),
    );
  });

  it('getAll returns messages for user', async () => {
    mockPrisma.messageToDisplay.findMany.mockResolvedValue([]);
    const result = await service.getAll('user1');
    expect(Array.isArray(result)).toBe(true);
    expect(mockPrisma.messageToDisplay.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user1' } }));
  });
});
