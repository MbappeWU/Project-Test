#!/usr/bin/env node
// Bundles the browser player into one self-contained HTML file: dist/sandscroll.html.
// The file works as a local page, an OBS Browser Source (?ui=0&autoplay=1) and a published artifact.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'sandscroll.html');
const result = await build({
  entryPoints: [path.join(root, 'src/web/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(path.join(root, 'src/web/index.html'), 'utf8').replace('<!-- APP -->', `<script>${js}</script>`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
