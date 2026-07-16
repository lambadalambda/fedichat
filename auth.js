// OAuth 2 + PKCE helpers for browser-only sign-in against Pleroma and
// Mastodon (the Pinafore/Elk pattern). Works in node too — WebCrypto is
// global there — so this stays testable.

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomVerifier() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(verifier));
  return b64url(digest);
}

export function authorizeUrl(instance, { clientId, redirectUri, scopes,
                                         challenge, state }) {
  const u = new URL(`https://${instance}/oauth/authorize`);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', scopes);
  // Servers without PKCE support (older Mastodon, Pleroma) ignore these
  // and fall back to the client_secret we also hold from /api/v1/apps.
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  if (state) u.searchParams.set('state', state);
  return u.toString();
}
