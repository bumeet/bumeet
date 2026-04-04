import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
    });

    return this.createSession(user.id, 'registration');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.createSession(user.id, 'password');
  }

  async createSession(userId: string, userAgent?: string, ipAddress?: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: { userId, token: randomUUID(), userAgent, ipAddress, expiresAt },
    });

    const token = this.jwt.sign(
      { sub: userId, sessionId: session.id },
      { secret: this.config.get('JWT_SECRET') || 'fallback-secret', expiresIn: '7d' },
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    return { token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } };
  }

  async oauthLogin(dto: { provider: string; email: string; name?: string }) {
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name ?? dto.email.split('@')[0] },
      });
    }
    return this.createSession(user.id, `oauth:${dto.provider}`);
  }

  async logout(sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
    return { success: true };
  }

  async getOAuthDemoUrl(provider: string, frontendUrl: string) {
    return `${frontendUrl}/auth/oauth-demo?provider=${provider}`;
  }
}
