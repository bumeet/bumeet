import type { DefaultSession } from 'next-auth';

// Carries the BUMEET API bearer token issued by /auth/oauth-login (or by the
// Credentials authorize() callback) through next-auth's User → JWT → Session
// chain, so the dashboard can read `session.apiToken` without `as any`.
declare module 'next-auth' {
  interface Session {
    apiToken?: string;
    user: DefaultSession['user'];
  }

  interface User {
    apiToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    apiToken?: string;
  }
}
