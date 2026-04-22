import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Slack from 'next-auth/providers/slack';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function getApiToken(provider: string, email: string, name?: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${apiUrl}/auth/oauth-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, email, name }),
    });
    if (!res.ok) {
      console.error('[auth] oauth-login failed:', res.status, await res.text());
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('[auth] oauth-login fetch error:', err);
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          return { id: data.user.id, email: data.user.email, name: data.user.name, image: data.user.avatarUrl, apiToken: data.token };
        } catch {
          return null;
        }
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID || process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: 'common',
      authorization: {
        params: { scope: 'openid profile email' },
      },
    }),
    Slack({
      clientId: process.env.AUTH_SLACK_ID || process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.AUTH_SLACK_SECRET || process.env.SLACK_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Credentials login — apiToken already set by authorize()
      if (user && (user as any).apiToken) {
        token.apiToken = (user as any).apiToken;
        return token;
      }
      // OAuth login — call backend to get API token
      if (account?.type === 'oauth' || account?.type === 'oidc') {
        const email = (profile?.email ?? (profile as any)?.preferred_username) as string | undefined;
        const name = (profile?.name ?? (profile as any)?.displayName) as string | undefined;
        console.log('[auth] OAuth login:', account.provider, 'email:', email);
        if (email) {
          const data = await getApiToken(account.provider, email, name);
          if (data) token.apiToken = data.token;
          else console.error('[auth] getApiToken returned null for', account.provider);
        } else {
          console.error('[auth] No email in profile for provider', account.provider, JSON.stringify(profile));
        }
      }
      return token;
    },
    session({ session, token }) {
      (session as any).apiToken = token.apiToken;
      return session;
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret',
  trustHost: true,
});
