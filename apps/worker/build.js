// eslint-disable-next-line @typescript-eslint/no-var-requires
require('esbuild').build({
  entryPoints: ['./src/main.js', './src/workflows-bundle.ts'],
  bundle: true,
  sourcemap: true,
  format: 'cjs',
  platform: 'node',
  external: ['@temporalio/*', './workflows-bundle.js'],
  outdir: './build',
  watch: true,
});
