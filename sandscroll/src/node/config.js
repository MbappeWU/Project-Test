import fs from 'node:fs';
import { PROGRAM } from '../scenes/index.js';

// Optional operator config (program.json): running order, hold time, seed and per-scene notes.
// Notes carry time-sensitive news lines, so operators can update them without touching code.
export function loadConfig(file) {
  const defaults = { program: PROGRAM, hold: 26, pace: 0.85, notes: {} };
  if (!file || !fs.existsSync(file)) return defaults;
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    ...defaults,
    ...cfg,
    program: Array.isArray(cfg.program) && cfg.program.length ? cfg.program : defaults.program,
    notes: cfg.notes || {},
  };
}
