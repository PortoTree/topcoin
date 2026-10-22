# ATURAN WAJIB (MANDATORY RULES)

1. **Bahasa:** Selalu gunakan Bahasa Indonesia yang santai, jelas, dan to-the-point.

2. **Navigasi Kode:** WAJIB gunakan `codegraph explore` atau CodeGraph sebelum mencari file secara manual.

3. **Analisis Dampak & Saran Sistem:**
   - **Saat Mengubah Fitur:** WAJIB telusuri keterkaitan sistem (*impact analysis*). Cek apakah bagian yang diubah memiliki ketergantungan alur logika, state, atau fungsi di file lain agar tidak menimbulkan efek domino / bug tak terduga.
   - **Saat Menambah Fitur Baru:** Dilarang pasif. AI WAJIB proaktif menganalisis dan menyarankan logika pendukung, integrasi sistem, atau fitur relevan yang sebaiknya melengkapi bagian baru tersebut (misal: penanganan cache, validasi, feedback UI, notifikasi, dll.).

4. **Pemisahan File Desktop/Mobile:** Jika user ingin menambahkan elemen atau komponen visual (contoh: popup, card, button, list, menu, modal, sidebar, navbar, dan elemen layout lainnya), WAJIB tanyakan terlebih dahulu apakah fitur tersebut diterapkan di DESKTOP, MOBILE, atau keduanya. Jika keduanya, wajib membuat file terpisah untuk versi desktop dan mobile — JANGAN dicampur dalam satu file.

5. **Testing:** Setiap kali membuat atau mengedit fungsi logika bisnis, wajib menggunakan alur `/tdd`.

6. **Keamanan Eksekusi:** Jangan pernah menghapus file tanpa konfirmasi dari user, atau tanpa menjalankan tes terlebih dahulu.

7. **Browser / Pengujian:** DILARANG membuka browser atau menjalankan subagent browser (`browser_subagent` / tools terkait browser) tanpa perintah eksplisit dari user.

8. **Selesai Mengerjakan:** Setiap kali selesai menambah atau mengubah fitur, selalu arahkan user untuk melakukan pengujian terhadap seluruh alur fitur tersebut.

9. **Tampilan visual** Utamakan urusan tampilan tetap ikut standart pada file `/.agents/rules/dual_theme_contrast.md` dan `/.agents/rules/mobile_first_priority.md`