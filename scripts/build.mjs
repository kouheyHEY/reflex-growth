import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await Promise.all([
  cp(path.join(root, 'index.html'), path.join(dist, 'index.html')),
  cp(path.join(root, 'styles.css'), path.join(dist, 'styles.css')),
  cp(path.join(root, 'growth.css'), path.join(dist, 'growth.css')),
  cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true }),
  cp(path.join(root, 'automation'), path.join(dist, 'automation'), { recursive: true })
]);
console.log(`Built ${dist}`);
