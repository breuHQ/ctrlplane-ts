import { build } from 'esbuild';

import { readFile } from 'fs/promises';

const pkg = JSON.parse(await readFile('./package.json', 'utf8'));
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

await build({
  entryPoints: ['./src/main.ts'],
  bundle: true,
  sourcemap: true,
  format: 'esm',
  platform: 'node',
  external: ['@temporalio/*', ...external],
  outdir: './build',
  treeShaking: true,
});
