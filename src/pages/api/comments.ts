import { Resend } from 'resend';

export const prerender = false;

interface CommentRequest {
  email: string;
  message: string;
}

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    let body: CommentRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { email, message } = body;

    // バリデーション
    if (!email || !message) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // メールアドレスの基本的なバリデーション
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Resendでメール送信
    const data = await resend.emails.send({
      from: 'noreply@resend.dev',
      to: import.meta.env.CONTACT_EMAIL,
      replyTo: email,
      subject: `New comment from ${email}`,
      html: `
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    });

    if (data.error) {
      throw new Error(data.error.message);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Comment sent successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending comment:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send comment. Please try again later.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// XSS対策：HTMLエスケープ関数
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
