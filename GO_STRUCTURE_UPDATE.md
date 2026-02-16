# 🏗️ GO PROJECT RESTRUCTURE

Saya telah merapikan struktur file Golang agar lebih profesional dan mudah di-maintain, serta mendukung single binary build.

## 📂 Struktur Baru:

```
docker-management/
├── cmd/
│   └── server/
│       └── main.go       # Entry point aplikasi
├── internal/
│   ├── api/              # Handler API & Router (sebelumnya handlers_*.go)
│   ├── database/         # Logika Database (init, log activity)
│   ├── models/           # Definisi Struct (ContainerInfo, dll)
│   └── ui/               # (Optional: logika UI tambahan)
├── web/                  # Frontend (HTML/CSS/JS) - Dulu 'frontend'
│   └── fs.go             # Embed script untuk menyatukan UI ke binary
├── go.mod                # Dependency management
├── build.bat             # Script untuk build jadi .exe
└── start.bat             # Script untun run (dev mode)
```

## ✨ Fitur Utama Update Ini:

1.  **Single Binary Build:**
    *   Folder `frontend` (sekarang `web`) sudah di-**embed** langsung ke dalam file executable menggunakan fitur `//go:embed`.
    *   Artinya, Anda cukup mendistribusikan `docker-manager.exe` saja, tanpa perlu copy folder `frontend` lagi!

2.  **Modular Code:**
    *   Kode tidak lagi menumpuk di root.
    *   Logika database dipisah ke `internal/database`.
    *   Handler API dikelompokkan di `internal/api`.
    *   Model data di `internal/models`.

3.  **Dependency Clean-up:**
    *   Menggunakan `go mod tidy` untuk merapikan dependency.

## 🚀 Cara Menggunakan:

### 1. Build menjadi Binary (Recommended)
Double click **`build.bat`**.
Hasilnya adalah file `docker-manager.exe` yang standalone.

### 2. Run Mode Development
Double click **`start.bat`** atau jalankan:
```bash
go run cmd/server/main.go
```

Selamat coding dengan struktur yang lebih rapi! 😎
