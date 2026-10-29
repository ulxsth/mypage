import assert from 'node:assert/strict';
import test from 'node:test';
import { handleComments, type CommentEnvironment, type CommentLimits } from '../src/server/comments.ts';

function environment(initial: Record<string, string> = {}): CommentEnvironment {
  const values = new Map(Object.entries(initial));
  const storage: CommentLimits = {
    async get(key) { return values.get(key) ?? null; },
    async put(key, value) { values.set(key, value); },
  };
  return {
    RESEND_API_KEY: 'test-email-key', CONTACT_EMAIL: 'owner@example.com',
    CONTACT_FROM: 'yotuDB <comments@example.com>', TURNSTILE_SITE_KEY: 'test-site',
    TURNSTILE_SECRET_KEY: 'test-secret', COMMENT_LIMITS: storage,
  };
}
const payload = { email: 'reader@example.net', message: '記事の感想です。', token: 'test-token' };
function request(body: unknown = payload, headers: Record<string, string> = {}) {
  return new Request('https://ulxsth.com/api/comments', {
    method: 'POST', headers: { Origin: 'https://ulxsth.com', 'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.10', ...headers }, body: JSON.stringify(body),
  });
}
const neverFetch: typeof fetch = async () => { throw new Error('External fetch must not occur'); };

test('missing settings expose only an unavailable public status', async () => {
  const response = await handleComments(new Request('https://ulxsth.com/api/comments'), {}, neverFetch);
  assert.deepEqual(await response.json(), { available: false, siteKey: null });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await handleComments(request(), {}, neverFetch)).status, 503);
});

test('rejects cross-origin and unsupported requests before external calls', async () => {
  assert.equal((await handleComments(request(payload, { Origin: 'https://attacker.example' }), environment(), neverFetch)).status, 403);
  assert.equal((await handleComments(request(payload, { 'Content-Type': 'text/plain' }), environment(), neverFetch)).status, 415);
  assert.equal((await handleComments(new Request('https://ulxsth.com/api/comments', { method: 'OPTIONS' }), environment(), neverFetch)).status, 405);
});

test('rejects invalid JSON shapes, types, email headers, message length, and missing tokens', async () => {
  for (const value of [null, [], {}, { ...payload, email: {} }, { ...payload, message: 10 },
    { ...payload, email: 'a@example.com\r\nBcc: victim@example.com' },
    { ...payload, email: 'a'.repeat(255) + '@example.com' },
    { ...payload, message: 'x'.repeat(5001) }, { ...payload, token: '' }]) {
    assert.equal((await handleComments(request(value), environment(), neverFetch)).status, 400);
  }
  const malformed = new Request('https://ulxsth.com/api/comments', {
    method: 'POST', headers: { Origin: 'https://ulxsth.com', 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal((await handleComments(malformed, environment(), neverFetch)).status, 400);
});

test('enforces streamed request size even without a content-length header', async () => {
  const response = await handleComments(request({ ...payload, message: 'x'.repeat(25000) }), environment(), neverFetch);
  assert.equal(response.status, 413);
});

test('Turnstile failure, wrong hostname, or wrong action never send email', async () => {
  for (const verification of [{ success: false }, { success: true, hostname: 'attacker.example', action: 'comment' },
    { success: true, hostname: 'ulxsth.com', action: 'login' }]) {
    let calls = 0;
    const mock: typeof fetch = async input => {
      assert.equal(String(input), 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      calls++;
      return Response.json(verification);
    };
    assert.equal((await handleComments(request(), environment(), mock)).status, 403);
    assert.equal(calls, 1);
  }
});

test('valid verified comments send plain text to the fixed configured recipient', async () => {
  let calls = 0;
  const mock: typeof fetch = async (input, init) => {
    calls++;
    if (calls === 1) return Response.json({ success: true, hostname: 'ulxsth.com', action: 'comment' });
    assert.equal(String(input), 'https://api.resend.com/emails');
    const email = JSON.parse(String(init?.body));
    assert.deepEqual(email.to, ['owner@example.com']);
    assert.equal(email.reply_to, payload.email);
    assert.equal(email.html, undefined);
    assert.ok(email.text.includes('<script>alert(1)</script>'));
    return Response.json({ id: 'test-only' });
  };
  assert.equal((await handleComments(request({ ...payload, message: '<script>alert(1)</script>' }), environment(), mock)).status, 200);
  assert.equal(calls, 2);
});

test('budget blocks the sixth verified attempt without sending another email', async () => {
  const env = environment();
  let emails = 0;
  const mock: typeof fetch = async input => {
    if (String(input).includes('siteverify')) return Response.json({ success: true, hostname: 'ulxsth.com', action: 'comment' });
    emails++;
    return Response.json({ id: 'test-only' });
  };
  for (let i = 0; i < 5; i++) assert.equal((await handleComments(request(), env, mock)).status, 200);
  const blocked = await handleComments(request(), env, mock);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '600');
  assert.equal(emails, 5);
});

test('invalid challenges never consume the shared delivery budget', async () => {
  const env = environment();
  env.COMMENT_LIMITS = { async get() { throw new Error('Storage must not be touched'); }, async put() { throw new Error('Storage must not be touched'); } };
  const mock: typeof fetch = async () => Response.json({ success: false });
  assert.equal((await handleComments(request(), env, mock)).status, 403);
});

test('storage and provider errors fail safely without leaking error details', async () => {
  const env = environment();
  env.COMMENT_LIMITS = { async get() { throw new Error('sensitive value'); }, async put() {} };
  const verified: typeof fetch = async () => Response.json({ success: true, hostname: 'ulxsth.com', action: 'comment' });
  const failed = await handleComments(request(), env, verified);
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes('sensitive'));
  let calls = 0;
  const mock: typeof fetch = async () => ++calls === 1
    ? Response.json({ success: true, hostname: 'ulxsth.com', action: 'comment' })
    : new Response('internal detail', { status: 500 });
  const delivery = await handleComments(request(), environment(), mock);
  assert.equal(delivery.status, 502);
  assert.ok(!(await delivery.text()).includes('internal'));
});
