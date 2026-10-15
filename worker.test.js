import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker, { browserLinks, validateTarget } from '../src/index.js';

const env = { ALLOWED_HOSTS: 'gsolusi.id,www.gsolusi.id' };
const origin = 'https://openinapp.example.workers.dev';
const android = 'Mozilla/5.0 (Linux; Android 14) Instagram 350 FB_IAB';
const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram';
const req = (path = '/', ua = 'Mozilla/5.0 Chrome/130 Safari/537.36', method = 'GET') => new Request(origin + path, { method, headers: { 'user-agent': ua } });
const go = target => '/go?url=' + encodeURIComponent(target);

test('generator, health, HEAD, unknown route, method handling', async () => {
  assert.equal((await worker.fetch(req(), env)).status, 200);
  assert.deepEqual(await (await worker.fetch(req('/health'), env)).json(), { ok: true, version: '1.1.0', configured: true });
  assert.equal(await (await worker.fetch(req('/', '', 'HEAD'), env)).text(), '');
  assert.equal((await worker.fetch(req('/missing'), env)).status, 404);
  assert.equal((await worker.fetch(req('/', '', 'POST'), env)).status, 405);
});

test('normal browser redirects; original query, encoding and fragment survive', async () => {
  const target = 'https://gsolusi.id/promo?utm_source=meta&q=a%2Bb#harga';
  for (const path of [go(target), '/?url=' + encodeURIComponent(target)]) {
    const response = await worker.fetch(req(path), env);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), target);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('outer tracking is forwarded, existing destination parameters take precedence', async () => {
  const response = await worker.fetch(req(go('https://gsolusi.id/?utm_source=original#harga') + '&utm_source=changed&fbclid=abc%2B123&utm_campaign=promo&auto=1&arbitrary=bad'), env);
  const target = new URL(response.headers.get('location'));
  assert.equal(target.searchParams.get('utm_source'), 'original');
  assert.equal(target.searchParams.get('fbclid'), 'abc+123');
  assert.equal(target.searchParams.get('utm_campaign'), 'promo');
  assert.equal(target.searchParams.has('auto'), false);
  assert.equal(target.searchParams.has('arbitrary'), false);
  assert.equal(target.hash, '#harga');
});

test('unsafe URLs and unauthorized hosts are rejected before redirects', async () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'https://evil.com', 'https://gsolusi.id.evil.com', 'https://evilgsolusi.id', 'https://gsolusi.id@evil.com', 'https://user:pass@gsolusi.id', 'https://gsolusi.id:8443', 'bad']) {
    assert.equal((await worker.fetch(req(go(url)), env)).status, 400, url);
  }
  assert.equal((await worker.fetch(req(go('https://gsolusi.id')), {})).status, 400);
  assert.throws(() => validateTarget(origin, { ALLOWED_HOSTS: 'openinapp.example.workers.dev' }, origin));
  assert.throws(() => validateTarget('https://gsolusi.id/' + 'a'.repeat(8192), env, origin));
});

test('wildcard domain permission is explicit and does not include apex or lookalikes', () => {
  const wildcard = { ALLOWED_HOSTS: '*.gsolusi.id' };
  assert.equal(validateTarget('https://promo.gsolusi.id', wildcard, origin).host, 'promo.gsolusi.id');
  assert.throws(() => validateTarget('https://gsolusi.id', wildcard, origin));
  assert.throws(() => validateTarget('https://gsolusi.id.evil.com', wildcard, origin));
});

test('Meta Android receives button; Chrome package only when requested', async () => {
  const response = await worker.fetch(req(go('https://gsolusi.id/promo'), android), env);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /href="intent:/);
  assert.doesNotMatch(body, /package=com.android.chrome/);
  assert.match(body, /"auto":false/);
  assert.match(await (await worker.fetch(req(go('https://gsolusi.id') + '&b=chrome', android), env)).text(), /package=com.android.chrome/);
});

test('iOS Chrome uses googlechromes and provides manual/direct fallback', async () => {
  const body = await (await worker.fetch(req(go('https://gsolusi.id/promo#harga') + '&b=chrome', ios), env)).text();
  assert.match(body, /href="googlechromes:\/\/gsolusi.id\/promo#harga"/);
  assert.match(body, /id="continue"/);
  assert.match(body, /Salin link tujuan/);
  assert.match(body, /Buka di Safari/);
});

test('intent retains hash; fallback disables auto and offers help instead of retry loop', () => {
  const links = browserLinks(new URL('https://gsolusi.id/promo?a=1#harga'), origin, 'chrome');
  assert.match(links.intent, /^intent:\/\/gsolusi.id\/promo\?a=1#harga#Intent;/);
  const fallback = new URL(decodeURIComponent(links.intent.match(/S.browser_fallback_url=([^;]+)/)[1]));
  assert.equal(fallback.searchParams.get('preview'), '1');
  assert.equal(fallback.searchParams.has('auto'), false);
  assert.equal(fallback.searchParams.get('url'), 'https://gsolusi.id/promo?a=1#harga');
});

test('preview always renders help and prevents automatic scheme launch', async () => {
  const body = await (await worker.fetch(req(go('https://gsolusi.id') + '&preview=1&auto=1'), env)).text();
  assert.match(body, /Buka di browser Anda/);
  assert.match(body, /"auto":false/);
});

test('generator API validates domain before giving out a link', async () => {
  const api = body => worker.fetch(new Request(origin + '/api/link', { method: 'POST', body: JSON.stringify(body) }), env);
  const ok = await api({ url: 'https://gsolusi.id/?utm_source=meta', browser: 'chrome', auto: true });
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.equal(new URL(data.link).searchParams.get('auto'), '1');
  assert.equal(new URL(data.link).searchParams.get('b'), 'chrome');
  assert.equal(new URL(data.preview).searchParams.has('auto'), false);
  assert.equal((await api({ url: 'https://evil.com' })).status, 400);
  assert.equal((await api(null)).status, 400);
  assert.equal((await worker.fetch(new Request(origin + '/api/link', { method: 'POST', body: '{' }), env)).status, 400);
});

test('inline script is safe with script-shaped input and valid JavaScript', async () => {
  const target = 'https://gsolusi.id/?q=%3C/script%3E%3Cscript%3Ealert(1)%3C/script%3E';
  for (const request of [req(), req(go(target), ios)]) {
    const response = await worker.fetch(request, env);
    const body = await response.text();
    const scripts = [...body.matchAll(/<script nonce="([^"]+)">([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    assert.match(response.headers.get('content-security-policy'), new RegExp('nonce-' + scripts[0][1]));
    new vm.Script(scripts[0][2]);
    assert.doesNotMatch(body, /<script>alert/);
  }
});
