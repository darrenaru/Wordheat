import GameBoard from "@/components/GameBoard";
import { getDailyPuzzle, loadManifest } from "@/lib/puzzles";

// Puzzle berganti setiap hari, jadi halaman ini tidak boleh dibekukan saat build.
export const dynamic = "force-dynamic";

function formatPuzzleLabel(id: number, isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const label = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `#${id} · ${label}`;
}

export default async function Page() {
  const puzzle = await getDailyPuzzle();
  const { vocabSize } = await loadManifest();

  // Hanya id, label, dan ukuran kosakata yang menyeberang ke klien. Kata
  // rahasianya tetap di server.
  return (
    <GameBoard
      puzzleId={puzzle.id}
      puzzleLabel={formatPuzzleLabel(puzzle.id, puzzle.date)}
      vocabSize={vocabSize}
    />
  );
}
