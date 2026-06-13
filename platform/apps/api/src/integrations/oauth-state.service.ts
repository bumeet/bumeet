import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';

interface StateEntry {
  userId: string;
  expiresAt: number;
}

/**
 * CSRF protection for OAuth connect flows.
 *
 * Previously each provider used `state = base64(userId)` — a predictable value
 * that handleCallback trusted directly, allowing an attacker to forge a callback
 * and attach a calendar to/from an arbitrary account. Instead we issue a random,
 * single-use, TTL-bound state and derive the userId from our own server-side
 * record, never from the inbound value.
 *
 * NOTE: in-memory store — fine for a single API instance. With >1 instance move
 * this to Redis or a DB row (issue() and consume() may otherwise hit different
 * instances).
 */
@Injectable()
export class OAuthStateService {
  private readonly states = new Map<string, StateEntry>();
  private static readonly TTL_MS = 10 * 60 * 1000;

  constructor() {
    setInterval(() => this.sweep(), 60_000);
  }

  /** Issue a random, single-use CSRF state bound to the initiating user. */
  issue(userId: string): string {
    const state = randomBytes(32).toString('base64url');
    this.states.set(state, { userId, expiresAt: Date.now() + OAuthStateService.TTL_MS });
    return state;
  }

  /** Verify and consume a state, returning the bound userId. Throws if invalid. */
  consume(state: string): string {
    const entry = state ? this.states.get(state) : undefined;
    if (!entry || Date.now() > entry.expiresAt) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    this.states.delete(state); // single-use
    return entry.userId;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.states) {
      if (now > entry.expiresAt) this.states.delete(key);
    }
  }
}
