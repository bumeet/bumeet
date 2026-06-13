import { NextRequest, NextResponse } from 'next/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { name?: unknown; email?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  // Basic validation + length caps (anti-spam / anti log-spam).
  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || name.length > 120 || email.length > 200 || message.length > 4000) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // NOTE: no delivery transport is wired yet — integrate Resend/SendGrid here and
  // return a 5xx if delivery fails so the client can show a failure state. Until
  // then we only build a mailto fallback and intentionally do NOT log the PII
  // (name/email/message) to server logs.
  const subject = encodeURIComponent(`BUMEET contact from ${name}`);
  const text = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
  const mailtoUrl = `mailto:rodes32@gmail.com?subject=${subject}&body=${text}`;

  return NextResponse.json({ ok: true, mailto: mailtoUrl });
}
