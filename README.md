# openinapp (Cloudflare Worker)

Membuka link dari in-app browser Meta (Instagram/Facebook/Messenger) di Safari/Chrome.

## Cara pakai
Link iklan: `https://NAMA-WORKER.workers.dev/?url=<link-tujuan-yang-di-encode>`
Buka halaman utama worker untuk membuat link otomatis.

## 1. Ubah domain yang diizinkan
Edit `wrangler.toml` -> `ALLOWED_HOSTS = "domainanda.com"`

## 2. Push ke GitHub
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/USERNAME/openinapp.git
git push -u origin main
```

## 3. Hubungkan GitHub ke Cloudflare
1. Cloudflare Dashboard -> Workers & Pages -> Create -> Import a repository.
2. Pilih repo `openinapp`, authorize GitHub.
3. Build command kosongkan, Deploy command: `npx wrangler deploy`.
4. Save and Deploy. Setiap `git push` ke `main` akan deploy otomatis.
5. (Opsional) Settings -> Domains & Routes -> tambah custom domain.

## Tes lokal
```bash
npm install
npm run dev
```
