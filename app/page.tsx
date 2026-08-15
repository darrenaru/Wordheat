import Landing from "@/components/Landing";
import { loadManifest } from "@/lib/puzzles";

export default async function Page() {
  // Ukuran kamus dibaca dari data yang benar-benar dipakai mesin permainan,
  // bukan angka yang ditulis tangan dan bisa basi diam-diam.
  const { vocabSize } = await loadManifest();
  return <Landing vocabSize={vocabSize} />;
}
