# Panduan Skills AI Agent (`.agents/skills`)

Dokumen ini berisi rangkuman fungsi masing-masing skill yang tersedia di dalam folder [`.agents/skills`](file:///c:/nethubz/.agents/skills), beserta panduan kapan dan bagaimana menggunakannya dalam alur kerja pengembangan software.

---

## Daftar Skill & Panduan Penggunaan

### 1. `ask-matt` (Pemandu / Router Alur)
* **Fungsi:** Peta induk dan "penunjuk jalan". Jika kamu bingung langkah apa yang harus diambil selanjutnya, skill ini akan mengarahkanmu ke alur dan skill yang tepat.
* **Kapan Digunakan:**
  * Saat kamu punya ide besar tapi bingung harus mulai dari mana.
  * **Contoh prompt:** *"Tanya Matt, alur mana yang cocok buat proyek baru ini?"*

---

### 2. `grill-me` (Wawancara & Pematangan Ide)
* **Fungsi:** Menguji ide secara agresif lewat wawancara mendalam (*back-and-forth Q&A*). Agent tidak akan langsung koding, melainkan mencari celah logika, batasan arsitektur, dan potensi risiko sebelum eksekusi.
* **Kapan Digunakan:**
  * Sebelum mulai membuat fitur baru saat ide masih kasar di kepala.
  * Ingin menguji kelayakan dan batasan solusi tanpa menyentuh kode.
  * **Contoh prompt:** *"Saya ada ide mau bikin fitur autentikasi multi-tenant, tolong grill-me dulu."*

---

### 3. `to-spec` (Membuat Dokumen Spesifikasi Teknis)
* **Fungsi:** Mengambil intisari dari hasil diskusi/chat dan merangkumnya menjadi dokumen spesifikasi teknis formal (*Problem Statement*, *Acceptance Criteria*, dan *Testing Seams*).
* **Kapan Digunakan:**
  * Setelah sesi tanya-jawab/brainstorming selesai dan ingin mendokumentasikan rencana sebelum dieksekusi.
  * **Contoh prompt:** *"Ubah hasil diskusi tadi jadi spec."*

---

### 4. `to-tickets` (Memecah Spec Menjadi Tiket Kerja)
* **Fungsi:** Memecah dokumen spesifikasi menjadi potongan tiket kecil (*tracer-bullet vertical slices*). Setiap tiket mendeklarasikan relasi ketergantungan (*blocking edges* / tiket mana yang wajib selesai lebih dulu).
* **Kapan Digunakan:**
  * Saat pekerjaan terlalu besar untuk satu sesi context window dan perlu dipecah menjadi unit tugas terukur.
  * **Contoh prompt:** *"Pecah spec ini jadi tickets."*

---

### 5. `implement` (Eksekusi Tiket / Koding)
* **Fungsi:** Mesin eksekutor pengerjaan tiket. Bekerja dengan disiplin ketat: wajib mengaitkan dengan pengujian (TDD), menjalankan typecheck berkala, dan diakhiri dengan review kode otomatis.
* **Kapan Digunakan:**
  * Saat tiket sudah siap dan kamu ingin agent mulai menulis kode.
  * **Contoh prompt:** *"Implement ticket #1."*

---

### 6. `tdd` (Test-Driven Development)
* **Fungsi:** Disiplin koding berbasis tes dengan siklus **Red $\rightarrow$ Green $\rightarrow$ Refactor**. Agent dilarang menulis kode implementasi sebelum membuat pengujian yang gagal terlebih dahulu.
* **Kapan Digunakan:**
  * Saat membangun logika bisnis yang sensitif dan membutuhkan jaminan anti-regresi.
  * **Contoh prompt:** *"Gunakan TDD untuk buat fungsi kalkulasi diskon ini."*

---

### 7. `frontend-design` (Panduan Estetika & Desain Visual)
* **Fungsi:** Mengarahkan agent agar bersikap layaknya *Design Lead*. Menghindari tampilan klise/template generik AI (gradient sembarangan, nomor hiasan tanpa konteks) dan menerapkan tipografi, tata letak, serta palet warna yang distingtif sesuai industri produk.
* **Kapan Digunakan:**
  * Saat membangun komponen antarmuka (UI), landing page, atau memperbarui tampilan visual.
  * **Contoh prompt:** *"Bikin halaman dashboard analitik ini dengan skill frontend-design agar tidak kelihatan seperti template generik."*

---

### 8. `diagnosing-bugs` (Investigasi Bug Sulit / Flaky)
* **Fungsi:** Protokol terstruktur untuk menangani bug rumit. Agent dilarang berspekulasi sebelum berhasil membuat satu perintah tes/feedback loop yang konsisten mereproduksi error (indikator merah).
* **Kapan Digunakan:**
  * Ketika ada bug yang sulit direproduksi, error intermiten/flaky, atau regresi performa.
  * **Contoh prompt:** *"Diagnose bug transaksi gagal ini."*

---

### 9. `code-review` (Review Kode Otomatis Dua Sumbu)
* **Fungsi:** Mengaudit perubahan kode di `git diff` menggunakan dua subagent paralel:
  * **Sumbu Standar:** Kepatuhan terhadap aturan dan gaya koding repository.
  * **Sumbu Spek:** Kesesuaian hasil kode dengan tiket/spesifikasi awal.
* **Kapan Digunakan:**
  * Sebelum melakukan merge branch atau membuat Pull Request (PR).
  * **Contoh prompt:** *"Tolong code-review perubahan sejak branch main."*

---

## Ringkasan Alur Kerja Ideal (*End-to-End Flow*)

```text
1. Pematangan Ide  ──► grill-me
2. Dokumentasi      ──► to-spec ──► to-tickets
3. Eksekusi         ──► implement (otomatis memicu tdd & frontend-design)
4. Validasi         ──► code-review
─────────────────────────────────────────────────────────────
(Jika Ada Masalah Berat / Flaky Bug ──► diagnosing-bugs)
```