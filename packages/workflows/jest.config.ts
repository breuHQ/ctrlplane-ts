// jest.config.ts
import path from 'path';
import { lstatSync, readdirSync } from 'fs';
import type { InitialOptionsTsJest } from 'ts-jest';
// import { defaults as tsjPreset } from 'ts-jest/presets';
import { defaultsESM as tsjPreset } from 'ts-jest/presets';
// import { jsWithTsESM as tsjPreset } from 'ts-jest/presets';
// import { jsWithTs as tsjPreset } from 'ts-jest/presets';

const pkgRoot = path.resolve(__dirname, '../../packages');
const packages = readdirSync(path.resolve(pkgRoot)).filter(name => lstatSync(path.join(pkgRoot, name)).isDirectory());

const config: InitialOptionsTsJest = {
  // [...]
  transform: {
    ...tsjPreset.transform,
    // [...]
  },
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },
  moduleNameMapper: {
    ...packages.reduce(
      (acc, name) => ({
        ...acc,
        [`@ctrlplane/${name}(.*)$`]: `<rootDir>/../../packages/./${name}/src/$1`,
      }),
      {},
    ),
  },
};

export default config;
