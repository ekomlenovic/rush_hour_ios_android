// Bundles the server and its generation worker, with the game logic of the app, into dist/
import { build } from 'esbuild';

await build({
  entryPoints: { server: 'src/index.ts', worker: 'src/worker.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
});
