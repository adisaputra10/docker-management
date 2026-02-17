# 🐳 Docker Manager - Modern Web Interface

**Docker Manager** adalah aplikasi web modern dan ringan untuk mengelola container Docker Anda dengan mudah. Dibangun dengan backend Go (Golang) yang cepat dan frontend Vanilla JS yang responsif, aplikasi ini menawarkan pengalaman manajemen Docker yang intuitif tanpa bloatware.

![Docker Dashboard](web/image1.png)

## ✨ Fitur Utama

### 🖥️ Dashboard Futuristik
- **Glassmorphism UI:** Tampilan modern dengan efek transparansi dan animasi halus.
- **Real-time Monitoring:** Pantau status container (Running/Stopped), jumlah image, volume, dan network secara instan.
- **Responsive Grid:** Informasi penting (ID, Image, Port, Created) ditampilkan dengan rapi.

### 🚀 Manajemen Container Lengkap
- **Kontrol Penuh:** Start, Stop, Restart, dan Kill container dengan satu klik.
- **Quick Exec:** Eksekusi perintah langsung ke dalam container tanpa membuka terminal terpisah.
- **Log Viewer:** Lihat log aktivitas container secara real-time.
- **Batch Actions:** Prune container yang tidak digunakan dengan cepat.

### 💻 Terminal Web Canggih
- **Full Screen Mode:** Terminal xterm.js yang terintegrasi penuh, memberikan pengalaman seperti terminal native di browser.
- **WebSocket Connection:** Koneksi real-time yang stabil dan responsif.
- **Fitur Lengkap:** Mendukung copy-paste, command history, dan resizing otomatis.

![Terminal View](web/image2.png)

### 🌍 Multi-Host Support
- **Kelola Banyak Server:** Hubungkan dan kelola multiple Docker Hosts (Local & Remote VM/VPS) dari satu dashboard.
- **Koneksi Aman:** Mendukung koneksi via TCP Socket dan SSH Tunneling.

### 🤖 AI Chatbot Assistant
- **Troubleshooting Pintar:** Diskusikan masalah container Anda langsung dengan AI (OpenAI/Ollama).
- **Context-Aware:** Chatbot otomatis membaca log dan status container untuk memberikan solusi yang relevan.



### 🛠️ Manajemen Resource Lainnya
- **Images:** Pull, Tag, Inspect, dan Hapus Docker Image.
- **Volumes:** Buat dan kelola Volume data persisten.
- **Networks:** Atur konfigurasi jaringan Docker dengan mudah.

## 🛠️ Teknologi yang Digunakan

- **Backend:** Go (Golang) - *Native net/http & Gorilla Mux*
- **Frontend:** HTML5, CSS3 (Modern Variables), Vanilla JavaScript (ES6+)
- **Database:** SQLite (untuk menyimpan konfigurasi Host dan Log Aktivitas)
- **Library:** Docker Go SDK, Xterm.js

## 📦 Cara Install & Menjalankan

### Prasyarat
- Go 1.24+ terinstall
- Docker Daemon berjalan

### Langkah Instalasi

1.  **Clone Repository**
    ```bash
    git clone https://github.com/adisaputra10/docker-management
    cd docker-management
    ```

2.  **Jalankan Aplikasi (Mode Development)**
    
    Menggunakan script (Windows):
    Double click **`start.bat`**

    Atau manual via terminal:
    ```bash
    go run cmd/server/main.go
    ```
    *Aplikasi akan berjalan di `http://localhost:8080`*

3.  **Build untuk Production (Single Binary)**
    
    Aplikasi ini mendukung **Single Binary Build**, artinya frontend (HTML/CSS/JS) sudah tertanam di dalam file `.exe`. Anda cukup mendistribusikan satu file saja!

    Menggunakan script (Windows):
    Double click **`build.bat`**
    
    Atau manual via terminal:
    ```bash
    go build -o docker-manager.exe ./cmd/server
    ```

    Setelah build selesai, jalankan file `docker-manager.exe` dan buka browser di `http://localhost:8080`.

## 🔌 Menghubungkan ke Remote Host (Multi-Server Setup)

Docker Manager mendukung pengelolaan server Docker yang tidak terbatas. Ikuti panduan ini untuk menyiapkan VM atau Server tambahan agar bisa diremote.

### 📝 Langkah 1: Persiapan di Server Remote (VM)

Lakukan langkah ini di setiap server/VM yang ingin Anda kelola:

1.  **Edit Konfigurasi Systemd Docker:**
    Buka file service docker dengan editor teks:
    ```bash
    sudo nano /lib/systemd/system/docker.service
    ```
    Cari baris yang dimulai dengan `ExecStart=` dan ubah menjadi:
    ```bash
    # Expose API Docker di port 2375 (TCP)
    ExecStart=/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock -H tcp://0.0.0.0:2375
    ```

2.  **Reload & Restart Docker:**
    Terapkan perubahan konfigurasi:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl restart docker
    ```

3.  **Verifikasi Port Terbuka:**
    Pastikan Docker sudah listen di port 2375:
    ```bash
    sudo netstat -lntp | grep dockerd
    # Output harus menampilkan: tcp6 0 0 :::2375 ...
    ```

### 🛡️ Langkah 2: Konfigurasi Firewall (Security)

**PENTING:** Membuka port 2375 membuat Docker daemon Anda dapat diakses oleh siapa saja. Pastikan Anda membatasi akses hanya dari IP Manager Anda.

Jika menggunakan **UFW** (Ubuntu/Debian):
```bash
# Izinkan akses HANYA dari IP komputer/server Docker Manager (misal: 192.168.1.10)
sudo ufw allow from 192.168.1.10 to any port 2375 proto tcp
sudo ufw reload
```

### 🔗 Langkah 3: Tambahkan di Dashboard

1.  Buka **Docker Manager** di browser.
2.  Lihat menu **Connections** di sidebar kiri bawah.
3.  Klik tombol **(+) Add Host**.
4.  Masukkan detail server:
    *   **Name:** Nama server (contoh: `Web-Server-01`)
    *   **URI:** Alamat IP server remote (contoh: `tcp://192.168.1.50:2375`)
5.  Klik **Connect**. Server baru akan muncul di daftar dan siap dikelola!



## 🤖 Konfigurasi AI Chatbot (OpenAI / Ollama)

Docker Manager kini dilengkapi dengan asisten AI untuk membantu troubleshooting. Secara default, fitur ini menggunakan API OpenAI, namun Anda dapat mengubahnya ke Local AI (Ollama).
![Chatbot Assistant](web/image3.png)

### Cara Mengatur:

1.  Klik ikon **Chat** di pojok kanan bawah layar.
2.  Klik ikon **Settings** (⚙️) di header chat window.
3.  Masukkan konfigurasi API Anda:
    -   **API Key:** Kunci API OpenAI Anda (`sk-...`). Jika menggunakan Ollama, Anda bisa memasukkan dummy text (misal: `ollama`).
    -   **Base URL:** Endpoint API.
        -   Untuk **OpenAI**: `https://api.openai.com/v1` (Default)
        -   Untuk **Ollama** (Local): `http://localhost:11434/v1`
4.  **Save Settings** untuk menyimpan konfigurasi.

*Catatan: API Key disimpan secara aman di database lokal aplikasi Anda.*

## 🔐 Single Sign-On (SSO) Configuration

Docker Manager supports enterprise-grade authentication using **GitLab** and **Microsoft Entra ID**.

### 1. GitLab SSO Setup
1.  Navigate to your GitLab instance (or GitLab.com) -> **Settings** -> **Applications**.
2.  Create a new application with the `read_user` scope.
3.  Set the **Redirect URI** to: `http://your-server-ip:8080/auth/gitlab/callback` (adjust port/domain as needed).
4.  Copy the **Application ID** and **Secret**.
5.  In Docker Manager, go to **Admin Panel** -> **SSO Settings**.
6.  Enable **GitLab SSO**, paste the credentials, and save.

### 2. Microsoft Entra ID (Azure AD) Setup
1.  Go to **Azure Portal** -> **App registrations** -> **New registration**.
2.  Set the **Redirect URI** (Web) to: `http://your-server-ip:8080/auth/entra/callback`.
3.  Copy the **Application (client) ID** and **Directory (tenant) ID**.
4.  Generate a **Client Secret** in "Certificates & secrets".
5.  In Docker Manager, go to **Admin Panel** -> **SSO Settings**.
6.  Enable **Entra ID**, paste the credentials, and save.

### ⚠️ Standard Login Toggle
You can disable the default username/password login form to force SSO usage.
- Go to **Admin Panel** -> **SSO Settings**.
- Toggle **Standard Login** to OFF.
- **Warning:** Ensure your SSO is working correctly before disabling this to avoid locking yourself out.

## 👥 User Management & RBAC (Role-Based Access Control)

The application implements a strict permission system to separate Administrators from Standard Users.

### Roles and Permissions

| Feature | 👑 Admin | 👤 User |
| :--- | :---: | :---: |
| **User Management** | Create, Edit, Delete Users | ❌ No Access |
| **Project Management** | Create, Assign Users/Resources | View Assigned Projects Only |
| **Docker Hosts** | Add, Connect, Delete Hosts | ❌ No Access |
| **Containers** | Full Control (Start, Stop, Kill, Delete, Exec) | **Restart Only** (Assigned Containers) |
| **SSO Settings** | Configure Providers | ❌ No Access |

### How it Works
1.  **Admins** create Projects (e.g., "Web App A") and assign specific Containers (Resources) to that Project.
2.  **Admins** create Users and assign them to the Project.
3.  **Users** log in and can *only* see the containers within their assigned projects. They are restricted to performing **safe actions** (Restart) to resolve issues without modifying infrastructure.

---

*Dibuat dengan ❤️ untuk komunitas Docker.*
