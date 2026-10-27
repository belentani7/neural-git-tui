import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// TypeScript compiles .ts but does not emit sibling .mjs runtime modules
// when their .d.mts declarations are already present in src/.
const sourceRoot = resolve('src');
const outputRoot = resolve('dist');

function copyModules(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) {
      copyModules(source);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      const destination = join(outputRoot, relative(sourceRoot, source));
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(source, destination);
    }
  }
}

copyModules(sourceRoot);
