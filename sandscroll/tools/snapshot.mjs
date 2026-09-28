#!/usr/bin/env node
// Renders one scene (or the running programme) headlessly and saves PNG snapshots.
//   node tools/snapshot.mjs --scene moonrise --every 15 --out /tmp/snaps [--width 1280] [--fps 10] [--seed 2026]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Show } from '../src/core/show.js';
import { SCENES, PROGRAM } from '../src/scenes/index.js';
import { nodeCanvas, savePng } from '../src/node/canvas.js';

const { values: args } = parseArgs({
  options: {
    scene: { type: 'string' },
    every: { type: 'string', default: '15' },
    out: { type: 'string', default: 'snapshots' },
    width: { type: 'string', default: '1280' },
    fps: { type: 'string', default: '10' },
    seed: { type: 'string', default: '2026' },
    seconds: { type: 'string' },
    prefix: { type: 'string' },
  },
});

const width = Number(args.width);
const height = Math.round((width * 9) / 16);
const fps = Number(args.fps);
const every = Number(args.every);
const program = args.scene ? args.scene.split(',') : PROGRAM;
for (const id of program) if (!SCENES[id]) throw new Error(`unknown scene ${id}`);
fs.mkdirSync(args.out, { recursive: true });

const show = new Show({ width, height, seed: Number(args.seed), canvas: nodeCanvas(), program, hold: 6 });
const prefix = args.prefix || program.join('+');
let t = 0;
let nextShot = every;
let renderMs = 0;
let frames = 0;
const limit = args.seconds ? Number(args.seconds) : Infinity;
show.update(0);
while (t < limit) {
  show.update(1 / fps);
  const t0 = performance.now();
  show.render();
  renderMs += performance.now() - t0;
  frames++;
  t += 1 / fps;
  if (t >= nextShot) {
    savePng(show.frame, width, height, path.join(args.out, `${prefix}-${String(Math.round(t)).padStart(4, '0')}s.png`));
    nextShot += every;
  }
  if (!args.seconds && show.index >= program.length && !show.stage.busy) break;
}
savePng(show.frame, width, height, path.join(args.out, `${prefix}-final.png`));
console.log(`${prefix}: ${t.toFixed(1)}s of show, avg render ${(renderMs / frames).toFixed(2)} ms/frame`);
