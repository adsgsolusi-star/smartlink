# BukaLink — Cloudflare Worker

Web app pembuat link untuk iklan, dengan halaman bantuan membuka browser di luar Instagram/Facebook/Messenger/TikTok/LINE yang terdeteksi. Tidak perlu Firebase, KV, D1, atau framework frontend. Tidak ada login, statistik klik, atau penyimpanan link.

## Mulai dari sini: perbaiki deploy GitHub

Screenshot yang diberikan menunjukkan deployment manual Ready dan beberapa build GitHub Failed. Screenshot tidak memuat log, sehingga penyebab pastinya belum dapat dipastikan. Paket ini memperjelas konfigurasi dan menyediakan build check; keberhasilan deploy akun tetap harus diperiksa setelah diunggah.

### 1. Extract ZIP, lalu periksa dua pengaturan

Edit `wrangler.toml`:

```toml
name = "openinapp"
main = "src/index.js"
compatibility_date = "2026-10-01"
workers_dev = true

[vars]
ALLOWED_HOSTS = "gsolusi.id,www.gsolusi.id"
```

- `name`: samakan persis dengan nama Worker yang sedang dibuka di Cloudflare. Nama repository GitHub boleh berbeda. Jangan menggunakan contoh `openinapp` jika Worker existing bernama lain.
- `ALLOWED_HOSTS`: domain halaman tujuan, bukan domain Worker. Default sementara GSolusi; ganti jika iklan menuju domain lain. Masukkan hostname tanpa `https://`, tanpa `/promo`, dan tanpa port. `gsolusi.id` dan `www.gsolusi.id` dihitung terpisah. Jika diperlukan, `*.gsolusi.id` mengizinkan subdomain tetapi tidak domain induknya.

### 2. Upload source ke GitHub (tanpa terminal)

1. Buka repository GitHub yang sudah dihubungkan ke Worker.
2. Pilih **Add file → Upload files**.
3. Upload **isi** folder hasil extract: `src/`, `test/`, `package.json`, `package-lock.json`, `wrangler.toml`, dan `README.md`. Sertakan `.gitignore` dan `.nvmrc` bila menggunakan Git lokal. Keduanya tidak diperlukan untuk dashboard upload ini.
4. Pastikan halaman awal repository langsung memperlihatkan `wrangler.toml` dan `package.json`; bukan hanya satu folder pembungkus.
5. Pilih **Commit changes** ke branch `main`.

Jangan upload file ZIP saja. Cloudflare tidak mengekstrak ZIP dari repository sebagai project. Hindari dua salinan `wrangler.toml` di folder berbeda karena mudah mengedit salinan yang tidak digunakan build.

Jika memakai Git lokal dari dalam folder project:

```bash
git init
git add .
git commit -m "Fix Worker build and browser handoff"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Untuk repository yang sudah ada, gunakan clone/update repository tersebut dan commit/push biasa. Jangan mengulang `git init` atau memaksa overwrite history.

### 3. Atur Cloudflare Workers Builds

**Worker existing:** Workers & Pages → pilih Worker → Settings → Builds / Build configuration. Jika belum terhubung, hubungkan repository GitHub di bagian tersebut.

**Worker baru:** Workers & Pages → Create application → Import a repository → pilih GitHub dan repository. Buat sebagai **Worker**, lalu gunakan nama yang sama dengan `name` di `wrangler.toml`.

| Pengaturan | Nilai |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` jika file config ada di root repository |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Non-production deploy command, jika diminta | `npx wrangler versions upload` |
| Build variable `NODE_VERSION` | `22` |
| API token | Token build yang dibuat/dipilih lewat Cloudflare, dengan izin deploy Worker ini |

`npm run build` memeriksa bundling dengan dry run; tidak mengunggah deployment. `npm run deploy` melakukan deployment sebenarnya. Tidak ada build output directory atau `dist` yang perlu disetel di dashboard: project ini adalah Worker dengan entry point `src/index.js`.

**Jika repository Anda masih membungkus source dalam `openinapp-worker/`:** set Root directory ke `/openinapp-worker/`. Pilih satu struktur saja; root directory harus menjadi lokasi `package.json` dan `wrangler.toml`.

Cloudflare memasang dependency dari `package.json` dan lockfile. Tidak perlu membuat GitHub Actions atau menaruh Cloudflare API token di source. Jangan memasukkan token akun, password, atau API key ke repository.

Simpan pengaturan, lalu gunakan **Retry build / Retry deployment** bila tersedia, atau buat commit baru di `main`. Tunggu status terbaru berhasil. Deployment lama yang Ready tidak membuktikan commit terbaru sudah aktif.

### 4. Verifikasi aplikasi aktif

1. Buka URL `workers.dev` yang ditampilkan di dashboard, tanpa `?url=...`. Harus muncul halaman **BukaLink**, bukan Hello World.
2. Buka `/health` pada URL yang sama. Harus muncul JSON `ok: true`, `version: "1.1.0"`, dan `configured: true`. Ini hanya tes aplikasi hidup; bukan tes perpindahan browser.
3. Masukkan `https://gsolusi.id/` atau domain yang sudah Anda izinkan, klik **Buat link iklan**, lalu **Pratinjau halaman bantuan**.
4. Jika memasukkan domain lain, generator harus menolak dan memberi tahu host yang perlu ditambahkan.

## Jika build masih gagal

Klik **Build ↗** pada baris deployment **Failed** terbaru. Buka/expand log lalu cari baris `[ERROR]`, `npm ERR!`, atau alasan kegagalan pertama. Salin sekitar 20–30 baris di sekitarnya; jangan sertakan API token atau secret. Daftar deployment saja belum memperlihatkan penyebab.

| Isi error / gejala | Yang diperiksa |
| --- | --- |
| `Missing entry-point`, config tidak ditemukan | Root directory, keberadaan `wrangler.toml`, dan `main = "src/index.js"` |
| Worker name mismatch | `name` pada config harus sama dengan Worker dashboard |
| `Missing script: build` | `package.json` versi baru belum ada pada branch/root yang dipakai |
| `Authentication error`, unauthorized, atau stale token | Perbaiki token melalui Settings → Builds; cek akun dan izin GitHub repository |
| Module/file not found | Pastikan seluruh `src/` terunggah, termasuk `pages.js`; cek huruf besar/kecil nama file |
| npm / engine / Node error | Set `NODE_VERSION=22`, pastikan lockfile ikut di-commit |
| Build berhasil tetapi Hello World masih tampil | Cek URL Worker, deployment yang aktif, branch, dan cache browser; cocokkan `/health` |
| Link ditolak dengan pesan domain | Perbaiki ALLOWED_HOSTS di config lalu commit/deploy ulang; bukan error build |

## Cara menggunakan untuk Meta Ads

1. Buka halaman utama Worker dan tempel URL landing page lengkap, misalnya `https://gsolusi.id/?utm_source=meta&utm_medium=paid_social&utm_campaign=promo`.
2. Pilih browser perangkat atau Chrome. Pilihan Chrome membutuhkan Chrome terpasang.
3. Untuk awal, biarkan **Coba buka otomatis** tidak dicentang. Jika ingin eksperimen, centang dan uji sendiri di perangkat sasaran. Perpindahan otomatis boleh diblokir oleh aplikasi.
4. Klik **Buat link iklan**, salin hasilnya, lalu gunakan sebagai Website URL di iklan.
5. Untuk iPhone, tersedia percobaan Safari/browser perangkat, Chrome, salin link, petunjuk menu aplikasi, dan **Lanjut di sini** sebagai cadangan.

Link baru berbentuk `/go?url=<URL-ter-encode>`. Link lama `/?url=...` tetap didukung. Jangan menempel URL tujuan mentah setelah `?url=` karena karakter `&` dapat memisahkan parameter yang seharusnya berada di URL tujuan. Gunakan generator.

Parameter:

| Parameter luar | Efek |
| --- | --- |
| `url` | URL tujuan lengkap dan ter-encode; wajib pada `/go` |
| `b=chrome` | Memprioritaskan tombol/intent Chrome pada perangkat yang sesuai |
| `auto=1` | Mencoba custom scheme sekali di in-app browser yang terdeteksi; tidak dijamin |
| `preview=1` | Menampilkan bantuan di browser biasa dan mematikan percobaan otomatis |
| `utm_*`, `fbclid`, `gclid`, `msclkid`, `wbraid`, `gbraid`, `ttclid` | Diteruskan ke tujuan jika parameter yang sama belum ada di tujuan |

Browser biasa langsung menerima HTTP 302 ke tujuan. Deteksi aplikasi menggunakan User-Agent, sehingga dapat meleset jika aplikasi mengubah atau menyamarkan identitasnya. Memilih Chrome tidak memindahkan pengguna yang sudah ada di browser biasa.

### Batasan yang perlu dipahami

- Website tidak dapat menjamin memaksa keluar dari browser internal Meta, terutama di iPhone. Tombol menggunakan ketukan pengguna, lalu aplikasi/OS memutuskan apakah boleh berpindah.
- Android memakai `intent://`, dengan opsi package Chrome. Browser perangkat dapat memunculkan pemilih atau tetap menahan navigasi. iOS memakai scheme Chrome yang didokumentasikan; percobaan `x-safari-https:` bersifat eksperimental, hanya untuk HTTPS, dan bukan jaminan Safari di semua versi iOS.
- Jika intent gagal, browser yang mendukung fallback diarahkan kembali ke halaman bantuan tanpa percobaan otomatis berulang. Cadangan **Lanjut di sini** selalu menuju tujuan yang sama.
- Query dan fragment tujuan dipertahankan. Parameter pelacakan diteruskan, tetapi perpindahan browser dapat mengganti cookie/session. Kinerja Pixel, atribusi, consent, dan conversion harus diuji di website tujuan; tidak dijamin oleh Worker ini. Worker tidak memasang Pixel atau Conversions API.
- Jangan gunakan parameter URL untuk password atau token login rahasia. Link generator ini terlihat publik, sedangkan domain tujuan dibatasi server.
- Pastikan tujuan sesuai isi iklan. Tidak ada pembedaan tujuan reviewer/manusia, dan tidak ada fitur cloaking.

## Tes lokal

Gunakan Node.js 22+:

```bash
npm ci
npm test
npm run build
npm run dev
```

Buka URL lokal yang dicetak Wrangler (biasanya `http://localhost:8787`). Tes Node memeriksa routing, validasi domain/URL, payload berbahaya, pelacakan, platform, HTML/script, dan intent fallback. Build dry run memeriksa konfigurasi dan bundling. Tes ini tidak dapat membuktikan izin perpindahan aplikasi pada HP.

## Checklist uji HP sebelum iklan aktif

| Pengujian | Hasil yang diperiksa |
| --- | --- |
| Chrome/Safari biasa, link tanpa preview | Langsung ke landing page yang benar |
| Facebook dan Instagram Android | Tombol browser, pilihan Chrome, cadangan menu/salin |
| Facebook dan Instagram iPhone | Tombol percobaan Safari/Chrome dan petunjuk manual |
| Chrome tidak terpasang | Cadangan masih bisa dipakai, bukan halaman kosong |
| `auto=1` ditolak aplikasi | Tombol/menu/salin tetap tersedia |
| UTM dan fbclid dari link iklan | Parameter sampai di landing page; periksa URL dan alat analitik tujuan |
| Fragment seperti `#harga` | Tujuan/anchor benar setelah perpindahan |
| Iklan uji dari placement asli | Alur landing dan conversion diverifikasi di perangkat sasaran |

## Rujukan teknis

Ditinjau 15 Oktober 2026; perilaku aplikasi sumber dapat berubah.

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/
- https://developer.chrome.com/docs/android/intents
- https://chromium.googlesource.com/chromium/src/+/main/docs/ios/opening_links.md
