const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function page(title, body, nonce, script = '') {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
:root{color-scheme:light;--ink:#182735;--muted:#596976;--line:#dbe3e6;--accent:#126a51;--pale:#eaf5ef}*{box-sizing:border-box}body{margin:0;background:#f4f7f5;color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:660px;margin:56px auto;padding:0 20px}header{display:flex;align-items:center;gap:10px;margin-bottom:36px;font-weight:750}.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--accent);color:white}h1{font-size:clamp(27px,5vw,36px);line-height:1.18;letter-spacing:-1px;margin:10px 0 16px}h2{font-size:16px;margin:0 0 8px}p{margin:0 0 20px;color:var(--muted)}.eyebrow{font-size:12px;color:var(--accent);font-weight:750;letter-spacing:1.2px}.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px;margin:24px 0}.hint{font-size:13px;color:var(--muted);margin:8px 0 0}.notice{background:var(--pale);border-radius:10px;padding:13px 15px;margin:18px 0;font-size:14px}.error{color:#a4262c}.host{font-weight:700;overflow-wrap:anywhere}label{display:block;font-weight:650;font-size:14px;margin-bottom:7px}input[type=url],textarea,select{width:100%;border:1px solid #bfcdd2;border-radius:9px;padding:12px;font:inherit;color:var(--ink);background:#fff}select{margin-bottom:16px}.row{margin-top:18px}.check{display:flex;gap:10px;align-items:flex-start;font-weight:400}.check input{margin-top:5px}button,.btn{display:block;text-align:center;width:100%;border:0;border-radius:10px;background:var(--accent);color:#fff;padding:13px 16px;font:650 15px/1.4 system-ui;cursor:pointer;text-decoration:none;margin-top:12px}.alt{background:#fff;border:1px solid var(--line);color:var(--ink)}button:disabled{opacity:.6;cursor:wait}a{color:var(--accent)}:focus-visible{outline:3px solid #e9b94b;outline-offset:3px}[hidden]{display:none!important}textarea{min-height:110px;font:13px/1.6 ui-monospace,monospace;resize:vertical}ol{padding-left:22px;font-size:14px}li{margin:7px 0}footer{color:var(--muted);font-size:12px;margin:25px 0}.small{font-size:14px}.status{min-height:24px;margin-top:12px;overflow-wrap:anywhere}@media(max-width:480px){main{margin:25px auto}.card{padding:20px}header{margin-bottom:28px}}
</style></head><body><main><header><span class="mark" aria-hidden="true">↗</span>BukaLink</header>${body}<footer>BukaLink · Tautan menuju halaman yang sama, dengan pilihan membuka browser.</footer></main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`;
}

function copyFunction(text, button) {
  const fallback = () => window.prompt('Salin link di bawah ini:', text);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => { button.textContent = 'Link tersalin ✓'; }).catch(fallback);
  } else fallback();
}

export function generatorPage(hosts, nonce) {
  const body = `<div class="eyebrow">LINK UNTUK IKLAN ANDA</div><h1>Dari iklan, lanjut<br>ke browser pilihan.</h1><p>Buat tautan dengan pilihan membuka Chrome atau browser perangkat saat pengunjung datang dari aplikasi.</p>
<div class="notice">Pembukaan browser dapat memerlukan satu ketukan. Aplikasi sumber dan sistem perangkat menentukan apakah perpindahan diizinkan.</div>
<section class="card"><form id="form"><label for="url">Link tujuan</label><input id="url" name="url" type="url" placeholder="https://gsolusi.id/" required autocomplete="off"><p class="hint">Domain yang diizinkan: ${hosts.length ? hosts.map(esc).join(', ') : 'belum diatur — isi ALLOWED_HOSTS di wrangler.toml.'}</p>
<div class="row"><label for="browser">Pilihan browser di halaman bantuan</label><select id="browser"><option value="default">Browser perangkat</option><option value="chrome">Google Chrome (harus terpasang)</option></select></div>
<label class="check"><input id="auto" type="checkbox"><span>Coba buka otomatis <span class="hint">(eksperimental, dapat diblokir)</span></span></label>
<button id="make" type="submit">Buat link iklan ↗</button><p id="status" class="small status" role="status" aria-live="polite"></p></form>
<div id="result" hidden><hr><label for="output">Link yang dipasang di iklan</label><textarea id="output" readonly></textarea><button id="copy" type="button">Salin link</button><a id="preview" class="btn alt" target="_blank" rel="noopener" href="/">Pratinjau halaman bantuan</a></div></section>
<section class="small"><h2>Cara kerjanya</h2><ol><li>Tempel URL halaman tujuan beserta UTM jika diperlukan.</li><li>Gunakan hasilnya sebagai URL website pada iklan.</li><li>Di browser biasa, pengunjung langsung menuju tujuan. Di aplikasi yang terdeteksi, pengunjung mendapatkan tombol dan panduan membuka browser.</li></ol><p class="hint">Parameter pelacakan seperti fbclid dan UTM yang ditambahkan pada link iklan diteruskan ke tujuan. Parameter yang sudah ada pada URL tujuan dipertahankan.</p></section>`;
  return page('BukaLink — Pembuat link iklan', body, nonce, `const copyText=${copyFunction.toString()};(${generatorClient.toString()})();`);
}

function generatorClient() {
  const form = document.getElementById('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.getElementById('status');
    const button = document.getElementById('make');
    document.getElementById('result').hidden = true;
    status.classList.remove('error');
    status.textContent = 'Memeriksa link…';
    button.disabled = true;
    try {
      const response = await fetch('/api/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        url: document.getElementById('url').value.trim(),
        browser: document.getElementById('browser').value,
        auto: document.getElementById('auto').checked,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Link gagal dibuat.');
      document.getElementById('output').value = result.link;
      document.getElementById('preview').href = result.preview;
      document.getElementById('result').hidden = false;
      document.getElementById('copy').textContent = 'Salin link';
      status.textContent = 'Link siap dipakai. Coba pratinjau dan uji dari aplikasi sebelum menjalankan iklan.';
    } catch (error) {
      status.textContent = error.message || 'Koneksi bermasalah. Coba lagi.';
      status.classList.add('error');
    } finally { button.disabled = false; }
  });
  document.getElementById('copy').onclick = function () { copyText(document.getElementById('output').value, this); };
}

export function openPage(target, config, nonce) {
  const { platform, preference } = config;
  let href = target.href;
  let label = 'Lanjut ke halaman tujuan';
  if (platform === 'android') { href = config.intent; label = preference === 'chrome' ? 'Coba buka di Chrome' : 'Coba buka browser perangkat'; }
  if (platform === 'ios') { href = preference === 'chrome' ? config.chrome : config.safari || target.href; label = preference === 'chrome' ? 'Coba buka di Chrome' : config.safari ? 'Coba buka Safari / browser perangkat' : 'Lanjut ke halaman tujuan'; }
  const body = `<div class="eyebrow">LANJUT KE WEBSITE</div><h1>Buka di browser Anda.</h1><p>Tujuan: <span class="host">${esc(target.hostname)}</span></p><section class="card"><p class="small">Ketuk tombol di bawah. Jika aplikasi meminta izin membuka browser, pilih untuk melanjutkan.</p><a class="btn" id="go" href="${esc(href)}">${label} ↗</a>
${platform === 'ios' && preference !== 'chrome' ? `<a class="btn alt" href="${esc(config.chrome)}">Coba buka di Chrome</a><p class="hint">Pilihan Chrome memerlukan aplikasi Google Chrome.</p>` : ''}
<a id="continue" class="btn alt" href="${esc(target.href)}">Lanjut di sini</a><button class="alt" id="copy" type="button">Salin link tujuan</button><p class="small status" id="status" role="status" aria-live="polite">${config.auto ? 'Sedang mencoba membuka browser. Jika belum berpindah, ketuk tombol di atas.' : 'Pilih tombol untuk melanjutkan.'}</p></section>
<section class="notice"><h2>Masih terbuka di aplikasi?</h2><ol><li>Buka menu ⋯ / ⋮ atau ikon bagikan pada aplikasi.</li><li>Cari “Buka di browser”, “Open in external browser”, atau “Buka di Safari”. Nama dan letaknya dapat berbeda.</li><li>Jika tidak tersedia, salin link tujuan lalu tempel di Safari atau Chrome.</li></ol><p class="hint">${platform === 'ios' ? 'Percobaan Safari bersifat eksperimental dan dapat berbeda menurut versi iOS.' : 'Perpindahan browser mengikuti izin aplikasi dan pengaturan perangkat.'}</p></section>`;
  return page('Lanjutkan ke ' + target.hostname, body, nonce, `const config=${safeJSON(config)};const copyText=${copyFunction.toString()};(${openClient.toString()})();`);
}

function openClient() {
  // Jangan gunakan window.open atau klik sintetis sebagai pengganti user gesture.
  document.getElementById('copy').onclick = function () { copyText(config.url, this); };
  document.getElementById('go').addEventListener('click', () => {
    document.getElementById('status').textContent = 'Jika belum berpindah, gunakan menu aplikasi atau salin link tujuan.';
  });
  if (config.auto && config.platform !== 'other') {
    const destination = document.getElementById('go').href;
    try { window.location.assign(destination); } catch { /* Tombol dan petunjuk tetap tersedia. */ }
  }
}

export function errorPage(message, nonce) {
  return page('Link belum dapat dibuka', `<h1>Link belum dapat dibuka.</h1><section class="card"><p class="error">${esc(message)}</p><a class="btn" href="/">Kembali ke pembuat link</a></section>`, nonce);
}
