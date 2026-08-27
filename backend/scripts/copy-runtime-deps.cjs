const { cpSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const projectRoot = join(__dirname, '..');
const targetRoot = join(projectRoot, 'dist', 'node_modules');

mkdirSync(targetRoot, { recursive: true });
for (const dependency of ['libphonenumber-js']) {
  cpSync(
    join(projectRoot, 'node_modules', dependency),
    join(targetRoot, dependency),
    {
      recursive: true,
      force: true,
    }
  );
}
