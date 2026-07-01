# USDT/IDR Treasury Market Monitor

Dashboard order book USDT/IDR untuk Reku, Tokocrypto, Indodax, Pintu Pro, dan BCA e-Rate.

## File Utama

- `index.html` - dashboard frontend.
- `server.mjs` - server lokal untuk preview di komputer.
- `functions/proxy.js` - proxy Cloudflare Pages untuk deployment live.

## Jalankan Lokal

```powershell
node server.mjs
```

Buka:

```text
http://127.0.0.1:8000/
```

## Deploy Gratis yang Direkomendasikan

Gunakan Cloudflare Pages karena dashboard ini butuh endpoint `/proxy` untuk mengambil data dari API exchange dan BCA. GitHub Pages biasa hanya static hosting, sehingga `/proxy` tidak akan berjalan.

Cloudflare Pages akan memberi domain gratis seperti:

```text
https://nama-project.pages.dev
```

## Langkah Deploy via GitHub + Cloudflare Pages

1. Buat repository baru di GitHub.
2. Upload semua file project ini ke repository tersebut.
3. Buka Cloudflare Dashboard.
4. Masuk ke `Workers & Pages`.
5. Pilih `Create application`.
6. Pilih `Pages`.
7. Pilih `Connect to Git`.
8. Pilih repository GitHub yang berisi dashboard ini.
9. Build settings:
   - Framework preset: `None`
   - Build command: kosongkan, atau isi `exit 0`
   - Build output directory: `.`
10. Klik `Save and Deploy`.
11. Setelah deploy selesai, buka domain gratis dari Cloudflare Pages.

## Catatan

- Refresh data otomatis setiap 5 menit.
- Endpoint Pintu Pro memakai production API yang sama dengan Pintu Pro Web: `api.pintu.pro`.
- Jika ada API exchange yang berubah format, update logic fetch di `index.html` dan whitelist host di `functions/proxy.js`.
