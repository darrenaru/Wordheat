import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import express from 'express';
import { config } from './config.ts';
import { createApiRouter } from './http/api.ts';
import { attachGateway } from './ws/gateway.ts';
import { getEngine } from './semantic/engine.ts';
import { sweepSoloSessions } from './game/solo.ts';
import { sweepRooms } from './game/rooms.ts';
import { sweepInvites } from './game/invites.ts';
import { currentPuzzleDate } from './game/words.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLIENT_DIST = resolve(ROOT, 'dist/client');

// Muat lexicon lebih dulu supaya kesalahan data ketahuan saat start, bukan saat
// pemain pertama menebak.
const engine = getEngine();

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use('/api', createApiRouter());

if (config.isProduction) {
  if (!existsSync(CLIENT_DIST)) {
    console.error(`Build client tidak ditemukan di ${CLIENT_DIST}. Jalankan "npm run build" dulu.`);
    process.exit(1);
  }
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  // SPA fallback — semua rute non-API dilayani index.html.
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => {
    res.sendFile(resolve(CLIENT_DIST, 'index.html'));
  });
}

const server = createServer(app);
attachGateway(server);

const sweeper = setInterval(() => {
  sweepSoloSessions();
  sweepRooms();
  sweepInvites();
}, config.sweepIntervalMs);
sweeper.unref();

server.listen(config.port, () => {
  console.log(`Wordheat — server siap di http://localhost:${config.port}`);
  console.log(
    `  kosakata ${engine.vocabularySize} kata · ${engine.targets.length} kata target · kata harian ${currentPuzzleDate()}`,
  );
  if (!config.isProduction) {
    console.log('  mode dev: buka http://localhost:5173 (Vite mem-proxy /api dan /ws ke sini)');
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
