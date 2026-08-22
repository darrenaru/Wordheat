import "server-only";

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Basis data akun.
 *
 * Room bersifat sementara dan cukup disimpan di memori, tetapi profil dan
 * daftar teman harus bertahan melewati restart server. SQLite bawaan Node
 * dipakai supaya tidak ada dependensi baru maupun kompilasi native.
 *
 * Filesystem container di Railway bersifat sementara -- tanpa Volume yang
 * di-mount, semua yang ditulis ke disk (termasuk berkas ini) hilang setiap
 * kali layanannya di-deploy ulang. Kalau sebuah Volume sudah dipasang,
 * Railway otomatis menyediakan RAILWAY_VOLUME_MOUNT_PATH; berkasnya ditulis
 * ke situ supaya akun, profil, dan daftar teman selamat lintas deploy.
 */

const DB_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "wordheat.db");

/**
 * Peringatan sekali-tampil di log deploy kalau aplikasi berjalan di Railway
 * (dikenali dari variabel RAILWAY_ENVIRONMENT_NAME yang otomatis disuntikkan
 * Railway) tapi Volume-nya belum terpasang. Tanpa peringatan ini, kesalahan
 * konfigurasi seperti ini diam-diam menghapus semua akun di deploy
 * berikutnya, dan baru ketahuan setelah pemain melapor.
 */
if (!process.env.RAILWAY_VOLUME_MOUNT_PATH && process.env.RAILWAY_ENVIRONMENT_NAME) {
  console.warn(
    "[wordheat] RAILWAY_VOLUME_MOUNT_PATH tidak diset -- basis data (akun, profil, " +
      "daftar teman) ditulis ke filesystem sementara container dan akan HILANG di " +
      "deploy berikutnya. Pasang Volume untuk layanan ini di dashboard Railway " +
      "(Settings -> Volumes -> New Volume, atur mount path-nya) supaya persisten.",
  );
}

function migrate(db: DatabaseSync) {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      avatar_seed   TEXT NOT NULL,
      avatar_bg     TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    -- Dipisahkan dari tabel akun supaya satu akun bisa punya beberapa cara
    -- masuk. Menambah "google" nanti cukup menyisipkan satu baris di sini;
    -- profil, teman, dan riwayat pemainnya tidak ikut tersentuh.
    --
    --   kind='recovery' -> identifier berisi sidik jari kode pemulihan
    --   kind='google'   -> identifier berisi klaim "sub" dari Google
    --
    -- UNIQUE(kind, identifier) mencegah satu akun Google diikat ke dua profil.
    CREATE TABLE IF NOT EXISTS credentials (
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      identifier  TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      PRIMARY KEY (account_id, kind),
      UNIQUE (kind, identifier)
    );

    -- Hanya sidik jari token yang disimpan; nilai aslinya cuma ada di cookie
    -- perangkat pemain, sehingga bocornya berkas basis data tidak langsung
    -- memberi siapa pun akses masuk.
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash   TEXT PRIMARY KEY,
      account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at   INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_by_account ON sessions(account_id);

    CREATE TABLE IF NOT EXISTS friend_requests (
      id         TEXT PRIMARY KEY,
      from_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      to_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE (from_id, to_id)
    );
    CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_id);

    -- Pertemanan bersifat dua arah. Pasangan selalu disimpan terurut sehingga
    -- satu hubungan mustahil tercatat dua kali dengan urutan terbalik.
    CREATE TABLE IF NOT EXISTS friendships (
      a_id       TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      b_id       TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (a_id, b_id),
      CHECK (a_id < b_id)
    );
    CREATE INDEX IF NOT EXISTS friendships_b ON friendships(b_id);

    -- Satu baris per pemain per room yang selesai (rank 1 tercapai). Hanya
    -- pemain berakun yang tercatat -- tamu main tanpa jejak permanen, sesuai
    -- sifatnya yang sekali pakai. Room itu sendiri tetap di memori (lihat
    -- lib/rooms.ts); yang disimpan di sini cuma hasil akhirnya.
    CREATE TABLE IF NOT EXISTS game_results (
      id           TEXT PRIMARY KEY,
      account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      room_code    TEXT NOT NULL,
      guess_count  INTEGER NOT NULL,
      won          INTEGER NOT NULL, -- 0/1
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS game_results_by_account ON game_results(account_id);

    -- Pesan langsung antar teman. Berbeda dari room dan hasil game, obrolan
    -- memang harus bertahan lama -- riwayatnya tidak boleh hilang saat server
    -- dimulai ulang.
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      from_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      to_id       TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      read_at     INTEGER
    );
    CREATE INDEX IF NOT EXISTS messages_by_from ON messages(from_id);
    CREATE INDEX IF NOT EXISTS messages_by_to ON messages(to_id, read_at);

    -- Riwayat setiap perubahan saldo Coin (dapat maupun belanja), dipakai
    -- untuk saldo berjalan (SUM) sekaligus layar "Riwayat Koin" di profil.
    CREATE TABLE IF NOT EXISTS coin_ledger (
      id          TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      delta       INTEGER NOT NULL, -- positif = dapat, negatif = belanja
      reason      TEXT NOT NULL,
      meta        TEXT,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS coin_ledger_by_account ON coin_ledger(account_id, created_at DESC);

    -- Stok Power-Up yang dimiliki tiap akun, per jenis.
    CREATE TABLE IF NOT EXISTS power_up_inventory (
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (account_id, kind)
    );

    -- Penanda Power-Up sekali-pakai (reveal_initial/reveal_digits) yang sudah
    -- dipakai di puzzle solo tertentu -- mode solo tidak punya sesi server,
    -- jadi ini sekaligus mencegah pemain membeli ulang efek yang sama di
    -- puzzle yang sama, dan menyimpan hasilnya supaya muat ulang halaman
    -- tidak menghilangkan (atau mengacak ulang) apa yang sudah terbuka.
    CREATE TABLE IF NOT EXISTS solo_power_up_usage (
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      puzzle_id   INTEGER NOT NULL,
      kind        TEXT NOT NULL,
      result      TEXT,
      created_at  INTEGER NOT NULL,
      PRIMARY KEY (account_id, puzzle_id, kind)
    );

    -- Satu baris per kemenangan solo yang sudah dihadiahi Coin -- mencegah
    -- pemain mengirim ulang kata yang sama berkali-kali demi Coin, karena
    -- mode solo tidak melacak status permainan di server sama sekali.
    CREATE TABLE IF NOT EXISTS solo_wins (
      account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      puzzle_id    INTEGER NOT NULL,
      guess_count  INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      PRIMARY KEY (account_id, puzzle_id)
    );
  `);

  addColumn(db, "accounts", "avatar_options", "TEXT NOT NULL DEFAULT '{}'");
  // NULL berarti belum pernah diganti sejak dibuat -- pergantian pertama
  // tidak boleh kena cooldown, hanya pergantian berikutnya.
  addColumn(db, "accounts", "username_changed_at", "INTEGER");
  // Token acak (bukan username) untuk tautan "Tambah Cepat" -- sengaja tidak
  // bisa ditebak dari username publik, supaya menjadi teman lewat tautan ini
  // benar-benar butuh persetujuan pemiliknya (membagikan tautannya sendiri),
  // bukan sekadar tahu username orang lain. NULL sampai dibuat pertama kali.
  addColumn(db, "accounts", "quick_add_token", "TEXT");
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS accounts_quick_add_token ON accounts(quick_add_token) WHERE quick_add_token IS NOT NULL`,
  );
  // Saldo mata uang dalam game ("Coin"), dipakai untuk membeli Power-Up.
  addColumn(db, "accounts", "coins", "INTEGER NOT NULL DEFAULT 0");
}

/**
 * Menambah kolom pada tabel yang mungkin sudah berisi data.
 *
 * `CREATE TABLE IF NOT EXISTS` tidak menyentuh tabel yang sudah ada, jadi
 * kolom baru harus dipasang terpisah -- kalau tidak, pemasangan lama akan
 * jalan dengan tabel yang ketinggalan bentuk.
 */
function addColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Koneksi dipertahankan lintas pemuatan ulang modul saat pengembangan. */
const globalStore = globalThis as Record<string, unknown>;

/**
 * Ditandai per pemuatan modul, bukan per koneksi.
 *
 * Koneksinya sengaja bertahan di globalThis, jadi kalau migrasi hanya
 * dijalankan saat koneksi dibuat, kolom yang baru ditambahkan tidak akan
 * pernah terpasang selama proses pengembangan masih hidup -- dan
 * penyimpanannya gagal diam-diam. Migrasi bersifat idempoten, jadi aman
 * dijalankan ulang setiap kali berkas ini dimuat.
 */
let migrated = false;

export function db(): DatabaseSync {
  let instance = globalStore.__wordheatDb as DatabaseSync | undefined;
  if (!instance) {
    mkdirSync(DB_DIR, { recursive: true });
    instance = new DatabaseSync(DB_PATH);
    globalStore.__wordheatDb = instance;
  }
  if (!migrated) {
    migrate(instance);
    migrated = true;
  }
  return instance;
}
