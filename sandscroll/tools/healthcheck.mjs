#!/usr/bin/env node
// Container health check: the broadcaster touches a heartbeat file every minute while it streams.
import fs from 'node:fs';

const file = process.env.SANDSCROLL_HEARTBEAT || '/tmp/sandscroll.heartbeat';
const maxAge = Number(process.env.SANDSCROLL_HEARTBEAT_MAX_AGE || 180) * 1000;
try {
  const age = Date.now() - fs.statSync(file).mtimeMs;
  if (age > maxAge) {
    console.error(`heartbeat stale: ${Math.round(age / 1000)}s old`);
    process.exit(1);
  }
  console.log(`ok (${Math.round(age / 1000)}s)`);
} catch {
  console.error('no heartbeat yet');
  process.exit(1);
}
