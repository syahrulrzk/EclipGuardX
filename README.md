
# EclipGuardX

Panduan singkat untuk instalasi dan menjalankan EclipGuardX di server lain (Ubuntu / Debian).

README ini fokus ke langkah praktis agar bisa deploy aplikasi Next.js + Socket.IO + Prisma pada server produksi sederhana.

## Ringkasan

EclipGuardX adalah aplikasi Next.js (App Router) dengan server kustom (`server.ts`) yang menggabungkan Socket.IO. Database menggunakan Prisma dengan datasource SQLite (lihat `prisma/schema.prisma`).

## Prasyarat (contoh: Ubuntu 22.04+)

- Akses SSH ke server
- Node.js 18+ (disarankan via NodeSource atau nvm)
- npm (atau pnpm/yarn) — repo ini mengasumsikan `npm`
- Git
- Build tools (opsional): `build-essential` (untuk native addons jika diperlukan)
- (Opsional) Nginx sebagai reverse proxy

Contoh instalasi singkat:

```bash
# update
sudo apt update && sudo apt upgrade -y

# install curl, git
sudo apt install -y curl git

# Node.js 18 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# (opsional) build tools
sudo apt install -y build-essential
```

## Clone dan instalasi

```bash
# clone
git clone https://github.com/syahrulrzk/EclipGuardX.git
cd EclipGuardX

# pasang dependencies
npm ci
```

Catatan: repositori menggunakan `tsx` dan `nodemon` pada skrip dev; `tsx` sudah ada di `dependencies`.

## Variabel lingkungan (ENV)

Minimal variabel yang disarankan di server:

- `DATABASE_URL` — untuk SQLite bisa `file:./dev.db` atau path absolut `file:/var/lib/eclipguardx/data.db`
- `PORT` — port yang akan didengarkan oleh server (default 3000)
- `NODE_ENV=production` — untuk mode produksi

Buat file `.env` di root proyek (jika belum):

```
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=production
```

Pastikan file tersebut hanya dapat dibaca oleh user aplikasi.

## Database — Prisma

Repositori menggunakan Prisma dengan provider `sqlite` (lihat `prisma/schema.prisma`). Langkah setup:

```bash
# (opsional) generate client
npm run db:generate

# push schema ke database (untuk sqlite, ini akan buat file DB)
npm run db:push

# jalankan seed (jika ada)

```

Catatan produksi: jika Anda menggunakan DB berbeda (Postgres/MySQL), ubah `DATABASE_URL` dan `prisma/schema.prisma` sesuai, lalu gunakan migrasi yang sesuai (`npx prisma migrate deploy` dll.).

## Build & Run (Produksi)

1. Build aplikasi Next.js:

```bash
npm run build
```

2. Jalankan server:

```bash
# cara sederhana (foreground)
NODE_ENV=production PORT=3000 npm run start

# atau gunakan env file, lalu systemd/pm2 (contoh di bawah)
```

Server kustom (`server.ts`) mendengarkan di `127.0.0.1:${PORT}`. Rekomendasi: gunakan reverse proxy (Nginx) yang melayani dari public dan meneruskan ke `127.0.0.1:3000`.

## Contoh systemd service

Simpan sebagai `/etc/systemd/system/eclipguardx.service` (sesuaikan user, path proyek):

```
[Unit]
Description=EclipGuardX service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/youruser/EclipGuardX
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=file:/home/youruser/EclipGuardX/dev.db
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Setelah menambahkan file:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now eclipguardx
sudo journalctl -u eclipguardx -f
```

## Contoh PM2 (alternatif)

```bash
# pasang pm2 jika belum
sudo npm install -g pm2

cd /home/youruser/EclipGuardX
pm2 start "npm -- run start" --name eclipguardx --env production
pm2 save
pm2 monit
```

## Contoh konfigurasi Nginx (reverse proxy)

```
server {
	listen 80;
	server_name example.com;

	location / {
		proxy_pass http://127.0.0.1:3000;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
	}
}
```

Setelah konfigurasi, reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Logging & Debugging

- Logs server (jika menggunakan systemd): `sudo journalctl -u eclipguardx -f`
- Jika menjalankan manual: `server.log` dan `dev.log` dibuat oleh skrip (lihat skrip `dev` dan `start`).
- Pastikan `DATABASE_URL` benar dan dapat ditulis (untuk sqlite: folder harus ada dan writable oleh proses).

## Troubleshooting singkat

- Error: database tidak ditemukan / permission denied -> periksa `DATABASE_URL` dan permission folder.
- Next build gagal -> jalankan `npm run build` secara lokal untuk melihat error, cek versi Node.
- Socket.IO tidak terkoneksi dari frontend -> periksa endpoint WS `ws://<host>:<port>/api/socketio` dan konfigurasi proxy (Upgrade header). Server kustom menggunakan path `/api/socketio`.

## Ringkasan perintah cepat

```bash
git clone ...
cd EclipGuardX
npm ci
cp .env.example .env   # jika ada, atau buat .env sesuai instruksi
npm run db:generate
npm run db:push
npm run db:seed
npm run build
NODE_ENV=production PORT=3000 npm run start
```

---

Jika mau, saya bisa:

- Menambahkan file `.env.example` ke repo (jika belum ada)
- Menambahkan contoh `Dockerfile` / `docker-compose.yml` untuk deployment berbasis container
- Menghasilkan unit `systemd` terisi otomatis dengan path/user yang Anda inginkan

Beritahu saya opsi mana yang mau Anda tambahkan, dan saya akan buatkan patch.
