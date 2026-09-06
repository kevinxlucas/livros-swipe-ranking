import { cp, mkdir, rm } from 'node:fs/promises';

await rm('public', { recursive: true, force: true });
await mkdir('public', { recursive: true });
await Promise.all([
  cp('index.html', 'public/index.html'),
  cp('styles.css', 'public/styles.css'),
  cp('app.js', 'public/app.js'),
  cp('ranker.mjs', 'public/ranker.mjs'),
]);
console.log('Build concluído em public/');
