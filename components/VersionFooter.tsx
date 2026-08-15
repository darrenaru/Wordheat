import pkg from "@/package.json";

/**
 * Nomor versi dari package.json, supaya selalu cocok dengan apa yang benar-benar
 * ter-build -- tidak ada nilai yang diketik ulang secara terpisah dan bisa
 * lupa disinkronkan.
 */
export default function VersionFooter() {
  return (
    <footer className="py-6 text-center">
      <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--muted)]">
        v{pkg.version}
      </span>
    </footer>
  );
}
