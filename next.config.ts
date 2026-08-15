import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tanpa ini Turbopack menelusuri ke atas sampai C:\ mencari lockfile dan
  // ikut menyerap direktori home.
  turbopack: { root: import.meta.dirname },

  // Berkas peringkat dibaca lewat fs saat runtime, jadi harus ikut terbawa
  // ke bundel serverless alih-alih hanya ada saat pengembangan.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**"],
  },
};

export default nextConfig;
