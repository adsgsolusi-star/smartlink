import { generatorPage, openPage, errorPage } from './pages.js';

const INAPP = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger|TikTok|musical_ly|BytedanceWebview|Line\//i;
const TRACKING = /^(utm_[a-z0-9_]+|fbclid|gclid|msclkid|wbraid|gbraid|ttclid)$/i;
const COMMON = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
};

export function hostList(env) {
  return String(env.ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

export function validateTarget(raw, env, origin) {
  if (typeof raw !== 'string' || raw.length > 8192) throw new Error('Link tujuan terlalu panjang atau tidak valid.');
  let target;
  try { target = new URL(raw); } catch { throw new Error('Masukkan link lengkap, diawali https://.'); }
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Hanya link HTTP atau HTTPS yang diizinkan.');
  if (target.username || target.password) throw new Error('Link dengan username atau password tidak diizinkan.');
  if (target.port) throw new Error('Gunakan port standar HTTP/HTTPS.');
  const hosts = hostList(env);
  if (!hosts.length) throw new Error('ALLOWED_HOSTS belum diisi di wrangler.toml.');
  const host = target.hostname.toLowerCase();
  const allowed = hosts.some(h => h.startsWith('*.')
    ? host.endsWith('.' + h.slice(2)) && host !== h.slice(2)
    : host === h);
  if (!allowed) throw new Error('Domain ' + host + ' belum diizinkan. Tambahkan host ini ke ALLOWED_HOSTS di wrangler.toml, lalu deploy ulang.');
  if (target.origin === origin) throw new Error('Link tujuan tidak boleh kembali ke layanan pembuat link ini.');
  return target;
}

export function forwardTracking(target, source) {
  const existing = new Set(target.searchParams.keys());
  for (const [key, value] of source.searchParams) {
    if (TRACKING.test(key) && !existing.has(key)) target.searchParams.append(key, value);
  }
  return target;
}

export function platformFor(ua) {
  return /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'other';
}

export function browserLinks(target, origin, preference = 'default') {
  // Fallback kembali ke halaman bantuan, bukan memulai percobaan otomatis lagi.
  const fallback = new URL('/go', origin);
  fallback.searchParams.set('url', target.href);
  fallback.searchParams.set('preview', '1');
  fallback.searchParams.set('b', preference);
  const intent = target.href.replace(/^https?:/, 'intent:') +
    '#Intent;scheme=' + target.protocol.slice(0, -1) +
    ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;' +
    (preference === 'chrome' ? 'package=com.android.chrome;' : '') +
    'S.browser_fallback_url=' + encodeURIComponent(fallback.href) + ';end';
  return {
    intent,
    // Eksperimental: bukan kontrak API Safari yang dijamin di semua versi iOS.
    safari: target.protocol === 'https:' ? target.href.replace(/^https:/, 'x-safari-https:') : null,
    chrome: target.href.replace(/^https?:/, target.protocol === 'https:' ? 'googlechromes:' : 'googlechrome:'),
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...COMMON, 'content-type': 'application/json; charset=utf-8' } });
}

function html(render, status = 200) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  return new Response(render(nonce), { status, headers: {
    ...COMMON,
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  } });
}

async function handle(request, env) {
  const u = new URL(request.url);
  if (u.pathname === '/health' && ['GET', 'HEAD'].includes(request.method)) {
    return json({ ok: true, version: '1.1.0', configured: hostList(env).length > 0 });
  }
  if (u.pathname === '/api/link' && request.method === 'POST') {
    if (Number(request.headers.get('content-length')) > 16384) return json({ error: 'Permintaan terlalu panjang.' }, 413);
    try {
      const text = await request.text();
      if (text.length > 16384) return json({ error: 'Permintaan terlalu panjang.' }, 413);
      const body = JSON.parse(text);
      const target = validateTarget(body?.url, env, u.origin);
      const link = new URL('/go', u.origin);
      link.searchParams.set('url', target.href);
      if (body.browser === 'chrome') link.searchParams.set('b', 'chrome');
      if (body.auto === true) link.searchParams.set('auto', '1');
      const preview = new URL(link);
      preview.searchParams.delete('auto');
      preview.searchParams.set('preview', '1');
      return json({ link: link.href, preview: preview.href });
    } catch (error) { return json({ error: error instanceof SyntaxError ? 'Format permintaan tidak valid.' : error.message }, 400); }
  }
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...COMMON, allow: u.pathname === '/api/link' ? 'POST' : 'GET, HEAD' } });
  if (u.pathname === '/favicon.ico') return new Response(null, { status: 204, headers: COMMON });
  if (!['/', '/go'].includes(u.pathname)) return html(n => errorPage('Halaman tidak ditemukan.', n), 404);
  if (u.pathname === '/' && !u.searchParams.has('url')) return html(n => generatorPage(hostList(env), n));
  let target;
  try { target = forwardTracking(validateTarget(u.searchParams.get('url'), env, u.origin), u); }
  catch (error) { return html(n => errorPage(error.message, n), 400); }
  const ua = request.headers.get('user-agent') || '';
  const preview = u.searchParams.get('preview') === '1';
  if (!INAPP.test(ua) && !preview) return new Response(null, { status: 302, headers: { ...COMMON, location: target.href } });
  const preference = u.searchParams.get('b') === 'chrome' ? 'chrome' : 'default';
  const config = {
    url: target.href, platform: platformFor(ua), preference,
    auto: !preview && u.searchParams.get('auto') === '1',
    ...browserLinks(target, u.origin, preference),
  };
  return html(n => openPage(target, config, n));
}

export default {
  async fetch(request, env = {}) {
    const response = await handle(request, env);
    return request.method === 'HEAD' ? new Response(null, response) : response;
  },
};
