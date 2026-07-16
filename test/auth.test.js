import test from 'node:test';
import assert from 'node:assert/strict';
import { randomVerifier, pkceChallenge, authorizeUrl } from '../auth.js';
import { relTime } from '../comic.js';

test('pkceChallenge matches the RFC 7636 appendix B vector', async () => {
  const challenge = await pkceChallenge(
    'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
  assert.equal(challenge, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('randomVerifier: base64url charset, unique, long enough', () => {
  const a = randomVerifier(), b = randomVerifier();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43,128}$/);
});

test('authorizeUrl carries all OAuth params', () => {
  const u = new URL(authorizeUrl('lain.com', {
    clientId: 'abc', redirectUri: 'https://x.test/client.html',
    scopes: 'read write', challenge: 'CH', state: 'st1',
  }));
  assert.equal(u.origin, 'https://lain.com');
  assert.equal(u.pathname, '/oauth/authorize');
  assert.equal(u.searchParams.get('client_id'), 'abc');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://x.test/client.html');
  assert.equal(u.searchParams.get('scope'), 'read write');
  assert.equal(u.searchParams.get('code_challenge'), 'CH');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('state'), 'st1');
});

test('relTime buckets', () => {
  const now = Date.parse('2026-07-16T12:00:00Z');
  const at = s => new Date(now - s * 1000).toISOString();
  assert.equal(relTime(at(20), now), 'now');
  assert.equal(relTime(at(300), now), '5 min ago');
  assert.equal(relTime(at(7200), now), '2 h ago');
  assert.equal(relTime(at(200000), now), '2 d ago');
  assert.match(relTime(at(4e7), now), /2025|2026/); // over ~2 weeks: a date
});
