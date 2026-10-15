// Buka-di-browser: redirect dari in-app browser (Meta/IG/FB/TikTok) ke Safari/Chrome.
// Pemakaian: https://<worker>/?url=https%3A%2F%2Ftokoanda.com%2Fpromo%3Futm_source%3Dmeta

const INAPP = /(FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger|TikTok|musical_ly|BytedanceWebview|Line\/)/i;
const ANDROID = /android/i;
const IOS = /iphone|ipad|ipod/i;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const htmlRes = (body, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });

function allowed(target, env) {
  const list = (env.ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return false; // wajib diisi supaya tidak jadi open redirect
  const host = target.hostname.toLowerCase();
  return list.some((h) => host === h || host.endsWith("." + h));
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    const raw = u.searchParams.get("url");

    if (!raw) return htmlRes(generatorPage(u.origin));

    let target;
    try {
      target = new URL(raw);
      if (!["http:", "https:"].includes(target.protocol)) throw new Error();
    } catch {
      return htmlRes(errorPage("Link tujuan tidak valid."), 400);
    }
    if (!allowed(target, env)) {
      return htmlRes(errorPage("Domain tujuan belum diizinkan. Tambahkan ke ALLOWED_HOSTS."), 403);
    }

    const ua = request.headers.get("user-agent") || "";

    // Bukan in-app browser -> langsung lanjut.
    if (!INAPP.test(ua)) {
      return new Response(null, {
        status: 302,
        headers: { location: target.toString(), "cache-control": "no-store" },
      });
    }

    const platform = ANDROID.test(ua) ? "android" : IOS.test(ua) ? "ios" : "other";
    return htmlRes(openPage(target, platform));
  },
};

function openPage(target, platform) {
  const url = target.toString();
  const intent =
    `intent://${target.host}${target.pathname}${target.search}` +
    `#Intent;scheme=${target.protocol.replace(":", "")};` +
    `action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;` +
    `S.browser_fallback_url=${encodeURIComponent(url)};end`;
  const safari = `x-safari-${url}`;
  const chromeIOS = url.replace(/^http/, "googlechrome");

  const cfg = JSON.stringify({ platform, url, intent, safari, chromeIOS }).replace(/</g, "\\u003c");

  const steps =
    platform === "ios"
      ? `Ketuk <b>⋯</b> atau ikon kompas di pojok layar, lalu pilih <b>Buka di Safari</b>.`
      : `Ketuk <b>⋮</b> di pojok kanan atas, lalu pilih <b>Buka di browser</b>.`;

  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Membuka di browser…</title>
<style>
:root{color-scheme:light dark;--bg:#f6f7f4;--fg:#16201b;--mut:#5b6760;--card:#fff;--line:#dfe3dc;--acc:#0f7a4d;--accfg:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#0f1512;--fg:#e8eee9;--mut:#9aa8a0;--card:#17201b;--line:#27332c;--acc:#3ecf8e;--accfg:#06150e}}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:grid;place-items:center;padding:24px}
main{width:100%;max-width:400px}
h1{font-size:1.4rem;line-height:1.25;margin:0 0 8px}
p{margin:0 0 16px;color:var(--mut)}
.btn{display:block;width:100%;padding:14px 16px;border-radius:10px;border:0;background:var(--acc);color:var(--accfg);font:600 1rem system-ui,sans-serif;text-align:center;text-decoration:none;cursor:pointer}
.btn.alt{background:transparent;color:var(--fg);border:1px solid var(--line);margin-top:10px}
.btn:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.help{margin-top:20px;padding:14px 16px;border:1px solid var(--line);background:var(--card);border-radius:10px;font-size:.92rem;color:var(--mut)}
.host{font-weight:600;color:var(--fg);word-break:break-all}
</style></head>
<body><main>
<h1>Lanjutkan di browser Anda</h1>
<p>Halaman <span class="host">${esc(target.host)}</span> akan terbuka di browser bawaan perangkat.</p>
<a id="go" class="btn" href="${esc(platform === "android" ? intent : safari)}">Buka di browser</a>
${platform === "ios" ? `<a class="btn alt" href="${esc(chromeIOS)}">Buka di Chrome</a>` : ""}
<button class="btn alt" id="copy" type="button">Salin link</button>
<div class="help" id="help">Jika tidak terbuka otomatis: ${steps}</div>
</main>
<script>
(function(){
  var c=${cfg};
  var dest=c.platform==="android"?c.intent:c.platform==="ios"?c.safari:null;
  if(dest){setTimeout(function(){location.href=dest},150)}
  else{document.getElementById("go").href=c.url}
  document.getElementById("copy").addEventListener("click",function(){
    var b=this;
    function ok(){b.textContent="Link tersalin"}
    if(navigator.clipboard){navigator.clipboard.writeText(c.url).then(ok,function(){prompt("Salin link:",c.url)})}
    else{prompt("Salin link:",c.url)}
  });
})();
</script></body></html>`;
}

function errorPage(msg) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Link bermasalah</title>
<style>:root{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}main{max-width:380px}</style>
</head><body><main><h1>Link tidak bisa dibuka</h1><p>${esc(msg)}</p></main></body></html>`;
}

function generatorPage(origin) {
  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Pembuat link buka-di-browser</title>
<style>
:root{color-scheme:light dark;--bg:#f6f7f4;--fg:#16201b;--mut:#5b6760;--card:#fff;--line:#dfe3dc;--acc:#0f7a4d;--accfg:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#0f1512;--fg:#e8eee9;--mut:#9aa8a0;--card:#17201b;--line:#27332c;--acc:#3ecf8e;--accfg:#06150e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:32px 20px}
main{max-width:560px;margin:0 auto}
h1{font-size:1.6rem;line-height:1.2;margin:0 0 8px}
p{color:var(--mut);margin:0 0 20px}
label{display:block;font-weight:600;margin-bottom:6px}
input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:inherit}
input:focus-visible,button:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
button{margin-top:12px;padding:12px 18px;border-radius:10px;border:0;background:var(--acc);color:var(--accfg);font:600 1rem system-ui,sans-serif;cursor:pointer}
#out{margin-top:24px;display:none}
#res{word-break:break-all;padding:12px 14px;border:1px solid var(--line);background:var(--card);border-radius:10px;font:.9rem ui-monospace,Menlo,monospace}
</style></head>
<body><main>
<h1>Buat link buka-di-browser</h1>
<p>Tempel link tujuan iklan Anda (termasuk parameter UTM). Pakai hasilnya sebagai URL di Meta Ads.</p>
<label for="u">Link tujuan</label>
<input id="u" type="url" placeholder="https://tokoanda.com/promo?utm_source=meta" autocomplete="off">
<button id="mk" type="button">Buat link</button>
<div id="out"><label>Link untuk iklan</label><div id="res"></div><button id="cp" type="button">Salin</button></div>
</main>
<script>
var origin=${JSON.stringify(origin)};
document.getElementById("mk").onclick=function(){
  var v=document.getElementById("u").value.trim();
  try{new URL(v)}catch(e){alert("Link tidak valid. Awali dengan https://");return}
  document.getElementById("res").textContent=origin+"/?url="+encodeURIComponent(v);
  document.getElementById("out").style.display="block";
};
document.getElementById("cp").onclick=function(){
  var t=document.getElementById("res").textContent;
  if(navigator.clipboard){navigator.clipboard.writeText(t);this.textContent="Tersalin"}
};
</script></body></html>`;
}
