import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = resolve(PACKAGE_DIR, '..', '..');
const RULES_SRD_SRC = resolve(ROOT_DIR, 'packages/adapters/rules-srd/src');
const DND5E_API_SRC = resolve(ROOT_DIR, 'packages/adapters/dnd5e-api/src');

export default defineConfig({
  root: PACKAGE_DIR,
  resolve: {
    alias: {
      '@grimengine/rules-srd': resolve(RULES_SRD_SRC, 'index.ts'),
      '@grimengine/rules-srd/*': `${RULES_SRD_SRC}/*`,
      '@grimengine/rules-srd/armor': resolve(RULES_SRD_SRC, 'armor.ts'),
      '@grimengine/rules-srd/weapons': resolve(RULES_SRD_SRC, 'weapons.ts'),
      '@grimengine/rules-srd/monsters': resolve(RULES_SRD_SRC, 'monsters.ts'),
      '@grimengine/dnd5e-api': resolve(DND5E_API_SRC, 'index.ts'),
      '@grimengine/dnd5e-api/monsters': resolve(DND5E_API_SRC, 'monsters.ts'),
      '@grimengine/dnd5e-api/spells': resolve(DND5E_API_SRC, 'spells.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
