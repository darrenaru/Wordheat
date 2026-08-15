/**
 * Normalisasi ejaan tebakan.
 *
 * Dipakai server saat mencari kata di kosakata dan dipakai klien saat
 * memeriksa tebakan berulang. Keduanya harus memakai aturan yang sama persis;
 * kalau berbeda, satu kata bisa masuk daftar dua kali dengan ejaan berlainan.
 */
export function normalizeWord(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
