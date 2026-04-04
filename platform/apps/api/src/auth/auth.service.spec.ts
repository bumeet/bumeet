import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  session: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('register throws ConflictException if email exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
    await expect(service.register({ email: 'test@test.com', name: 'Test', password: 'password123' })).rejects.toThrow(ConflictException);
  });

  it('login throws UnauthorizedException for wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$invalid',
    });
    await expect(service.login({ email: 'test@test.com', password: 'wrongpassword' })).rejects.toThrow(UnauthorizedException);
  });

  it('login throws UnauthorizedException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'notfound@test.com', password: 'password' })).rejects.toThrow(UnauthorizedException);
  });
});
