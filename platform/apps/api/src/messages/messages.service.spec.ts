import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  messageToDisplay: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
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
    mockPrisma.messageToDisplay.create.mockResolvedValue(mockMessage);
    mockPrisma.messageToDisplay.update.mockResolvedValue({ ...mockMessage, status: 'sent' });

    const result = await service.create('user1', 'Hello');
    expect(result.status).toBe('pending');
    expect(result.content).toBe('Hello');
  });

  it('getAll returns messages for user', async () => {
    mockPrisma.messageToDisplay.findMany.mockResolvedValue([]);
    const result = await service.getAll('user1');
    expect(Array.isArray(result)).toBe(true);
    expect(mockPrisma.messageToDisplay.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user1' } }));
  });
});
