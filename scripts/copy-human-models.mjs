import { copyFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'node_modules', '@vladmandic', 'human', 'models');
const targetDir = join(root, 'public', 'models');

const requiredModels = [
  'blazeface.json',
  'blazeface.bin',
  'facemesh.json',
  'facemesh.bin',
  'faceres.json',
  'faceres.bin',
];

await mkdir(targetDir, { recursive: true });

for (const file of requiredModels) {
  const source = join(sourceDir, file);
  const target = join(targetDir, file);
  await access(source, constants.R_OK);
  await copyFile(source, target);
}

console.log(`[postinstall] Human face models copied to public/models (${requiredModels.length} files).`);
