import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface PairingEntry {
  approvedToken: string | null;
  expiresAt: number;
}

// Alphabet without ambiguous chars (0/O, 1/I/L)
const ALPHABET = 'BCDFGHJKMNPQRSTVWXYZ2345689';
const CODE_LEN = 6;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class PairingService {
  // In-memory store — codes are ephemeral (5 min TTL)
  private readonly pending = new Map<string, PairingEntry>();

  constructor(private prisma: PrismaService) {
    // Sweep expired codes every minute
    setInterval(() => this.sweep(), 60_000);
  }

  generateCode(): string {
    const bytes = randomBytes(CODE_LEN);
    return Array.from(bytes)
      .map(b => ALPHABET[b % ALPHABET.length])
      .join('');
  }

  register(code: string): void {
    this.pending.set(code.toUpperCase(), {
      approvedToken: null,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  async approve(code: string, userId: string): Promise<{ token: string } | null> {
    const entry = this.pending.get(code.toUpperCase());
    if (!entry || Date.now() > entry.expiresAt) return null;

    // Generate a long-lived per-user agent token
    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { agentToken: token },
    });

    entry.approvedToken = token;
    return { token };
  }

  poll(code: string): { status: 'pending' | 'approved' | 'expired'; token?: string } {
    const entry = this.pending.get(code.toUpperCase());
    if (!entry) return { status: 'expired' };
    if (Date.now() > entry.expiresAt) {
      this.pending.delete(code.toUpperCase());
      return { status: 'expired' };
    }
    if (entry.approvedToken) {
      const token = entry.approvedToken;
      this.pending.delete(code.toUpperCase()); // single-use
      return { status: 'approved', token };
    }
    return { status: 'pending' };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [code, entry] of this.pending) {
      if (now > entry.expiresAt) this.pending.delete(code);
    }
  }
}
