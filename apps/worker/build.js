import { build } from 'esbuild';

import { readFile } from 'fs/promises';

const pkg = JSON.parse(await readFile('./package.json', 'utf8'));
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

await build({
  entryPoints: ['./src/client.ts', './src/worker.ts', './src/workflows.ts'],
  bundle: true,
  sourcemap: true,
  // format: 'cjs',
  format: 'esm',
  platform: 'node',
  external: ['@temporalio/*', ...external],
  outdir: './build',
  treeShaking: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  // watch: true,
});

console.info('Build complete');
