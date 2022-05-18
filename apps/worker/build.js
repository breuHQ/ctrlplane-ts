import { build } from 'esbuild';

import { readFile } from 'fs/promises';

const pkg = JSON.parse(await readFile('./package.json', 'utf8'));
const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];
console.log(external);

// eslint-disable-next-line @typescript-eslint/no-var-requires
build({
  entryPoints: ['./src/client.ts', './src/worker.ts', './src/workflows.ts'],
  bundle: true,
  sourcemap: true,
  // format: 'cjs',
  format: 'esm',
  platform: 'node',
  external: ['@temporalio/*', ...external],
  outdir: './build',
  watch: true,
});
