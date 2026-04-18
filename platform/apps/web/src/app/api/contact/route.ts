import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Forward to owner email via mailto (no SMTP dependency needed at this stage).
  // Replace with SendGrid / Resend when ready for production.
  const subject = encodeURIComponent(`BUMEET contact from ${name}`);
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
  const mailtoUrl = `mailto:rodes32@gmail.com?subject=${subject}&body=${body}`;

  // Log for server-side debugging
  console.log('[contact]', { name, email, message: message.slice(0, 80) });

  return NextResponse.json({ ok: true, mailto: mailtoUrl });
}
