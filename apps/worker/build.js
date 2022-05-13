import { build } from 'esbuild';

// eslint-disable-next-line @typescript-eslint/no-var-requires
build({
  entryPoints: ['./src/client.ts', './src/worker.ts', './src/workflows.ts'],
  bundle: true,
  sourcemap: true,
  // format: 'cjs',
  format: 'esm',
  platform: 'node',
  external: ['@temporalio/*', './workflows-bundle.js'],
  outdir: './build',
  watch: true,
});
