import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // No fallback secret — getOrThrow surfaces a misconfiguration at boot.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; sessionId: string }) {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    // Carry the sessionId so logout/password-change can target the exact session.
    // Never spread the raw User row: it contains passwordHash and agentToken,
    // and /auth/me returns req.user verbatim to the browser.
    const { user } = session;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      language: user.language,
      batteryLevel: user.batteryLevel,
      batteryUpdatedAt: user.batteryUpdatedAt,
      bleDeviceAddress: user.bleDeviceAddress,
      bleCharacteristicUuid: user.bleCharacteristicUuid,
      createdAt: user.createdAt,
      sessionId: session.id,
    };
  }
}
