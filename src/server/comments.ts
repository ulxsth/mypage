export interface CommentLimits {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

export interface CommentEnvironment {
  RESEND_API_KEY?: string;
  CONTACT_EMAIL?: string;
  CONTACT_FROM?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  COMMENT_LIMITS?: CommentLimits;
}

const MAX_BODY_BYTES = 24 * 1024;
const MAX_MESSAGE_LENGTH = 5000;
const UNAVAILABLE = '現在コメントの受付を停止しています。';

function json(status: number, data: unknown, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=15552000',
      ...extraHeaders,
    },
  });
}

function configured(env: CommentEnvironment) {
  return Boolean(env.RESEND_API_KEY && env.CONTACT_EMAIL && env.CONTACT_FROM &&
    env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && env.COMMENT_LIMITS);
}

class BodyError extends Error {
  status: number;
  constructor(status: number) {
    super('Invalid request body');
    this.status = status;
  }
}

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new BodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new BodyError(400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new BodyError(400);
  }
}

// KV counters are an approximate abuse budget, not an atomic quota or an authentication boundary.
// Turnstile verification (including single-use token validation) is required separately.
async function reserveBudget(env: CommentEnvironment, ip: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.TURNSTILE_SECRET_KEY!),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  const budgets = [
    { key: `ip:${ipHash}:${Math.floor(now / 600000)}`, max: 5, ttl: 1200 },
    { key: `day:${Math.floor(now / 86400000)}`, max: 50, ttl: 172800 },
  ];
  const counts = await Promise.all(budgets.map(async budget => Number(await env.COMMENT_LIMITS!.get(budget.key) ?? 0)));
  if (counts.some((count, index) => !Number.isSafeInteger(count) || count < 0 || count >= budgets[index]!.max)) return false;
  await Promise.all(budgets.map((budget, index) => env.COMMENT_LIMITS!.put(budget.key,
    String(counts[index]! + 1), { expirationTtl: budget.ttl })));
  return true;
}

export async function handleComments(request: Request, env: CommentEnvironment, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'GET') return json(200, {
    available: configured(env),
    siteKey: configured(env) ? env.TURNSTILE_SITE_KEY : null,
  });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
  if (request.headers.get('origin') !== new URL(request.url).origin) return json(403, { error: '送信元を確認できません。' });
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return json(415, { error: 'Invalid content type' });
  }

  let body: unknown;
  try {
    body = await readBody(request);
  } catch (error) {
    return json(error instanceof BodyError ? error.status : 400, { error: '入力内容を確認してください。' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: '入力内容を確認してください。' });
  const { email, message, token } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof message !== 'string' || typeof token !== 'string' ||
    email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    !message.trim() || message.length > MAX_MESSAGE_LENGTH || !token || token.length > 2048) {
    return json(400, { error: '入力内容と確認チェックを確認してください。' });
  }
  if (!configured(env)) return json(503, { error: UNAVAILABLE });
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json(503, { error: UNAVAILABLE });

  try {
    const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!verification.ok) return json(503, { error: '確認サービスに接続できません。' });
    const result = await verification.json() as { success?: boolean; hostname?: string; action?: string };
    if (result.success !== true || result.hostname !== new URL(request.url).hostname || result.action !== 'comment') {
      return json(403, { error: '確認チェックをやり直してください。' });
    }
    // Unverified callers must not be able to consume the site's shared delivery budget.
    if (!await reserveBudget(env, ip)) return json(429, { error: 'しばらく待ってから再度お試しください。' }, { 'Retry-After': '600' });
    const delivery = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_EMAIL],
        reply_to: email.trim(),
        subject: 'yotuDB: 新しいコメント',
        text: `Email: ${email.trim()}\n\n${message.trim()}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!delivery.ok) return json(502, { error: '送信できませんでした。時間をおいてお試しください。' });
    return json(200, { success: true });
  } catch {
    return json(503, { error: '送信できませんでした。時間をおいてお試しください。' });
  }
}
