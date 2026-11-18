// Token Radar entrypoint (model radar-3). Node 22, standard library only.
//
// Reads a sealed DefiLlama snapshot and writes a ranked board, a static dashboard,
// screenshots and a dossier to the output directory:
//
//   node main.ts --input /input/snapshot.json --output /output
//
// --input may be the snapshot file or the directory holding snapshot.json; it defaults
// to /input/snapshot.json. --output defaults to MAKEFUN_OUTPUT_DIR, else /output.
//
// The run is deterministic: the same snapshot always writes byte-identical output, so
// the grader's two runs agree. Nothing here reads the clock, rolls dice, or depends on
// locale or object-key order; ties break on slug.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The value after a `--flag value` pair, or null when the flag is absent. */
function flagValue(argv: string[], flag: string): string | null {
  for (let i = 0; i + 1 < argv.length; i++) {
    if (argv[i] === flag) return argv[i + 1]!;
  }
  return null;
}

/** Fail with a message on stderr and a non-zero exit. */
function fail(message: string): never {
  console.error(`token-radar: ${message}`);
  process.exit(1);
}

/** The snapshot file behind --input: the file itself, or snapshot.json inside the directory. */
function snapshotPath(input: string): string {
  if (!existsSync(input)) fail(`snapshot not found: ${input}`);
  if (statSync(input).isDirectory()) {
    const inside = join(input, 'snapshot.json');
    if (!existsSync(inside)) fail(`snapshot not found: ${inside}`);
    return inside;
  }
  return input;
}

/** Copy a directory tree that must exist, refusing when it does not. */
function copyTree(from: string, to: string, what: string): void {
  if (!existsSync(from) || !statSync(from).isDirectory()) fail(`${what} directory missing: ${from}`);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

/** The dashboard must render with no network: no URL in any attribute, style or script. */
function assertNoNetwork(dir: string): void {
  const bad = /(\b(?:src|href|action)\s*=\s*["'][^"']*https?:)|@import\s+["']https?:|import\s*\(?\s*["']https?:|from\s+["']https?:/i;
  const walk = (d: string): void => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (/\.(html|css|js)$/.test(name.name) && bad.test(readFileSync(p, 'utf8'))) {
        fail(`dashboard/${p.slice(dir.length + 1)} references a network URL`);
      }
    }
  };
  walk(dir);
}

function main(): void {
  const argv = process.argv.slice(2);
  const input = flagValue(argv, '--input') ?? '/input/snapshot.json';
  const output = resolve(flagValue(argv, '--output') ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  const path = snapshotPath(input);

  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`snapshot cannot be read: ${path}`);
  }
  const snapshot = parseSnapshot(text!);
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) fail(`board refused: ${issue}`);

  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'board.json'), `${JSON.stringify({ rows: board }, null, 2)}\n`, 'utf8');
  if (statSync(join(output, 'board.json')).size > 8 * 1024 * 1024) fail('board.json is over the 8 MiB gate');
  writeFileSync(join(output, 'data.js'), dataScript(radar), 'utf8');
  copyTree(join(HERE, 'dashboard'), join(output, 'dashboard'), 'dashboard');
  assertNoNetwork(join(output, 'dashboard'));
  copyTree(join(HERE, 'screenshots'), join(output, 'screenshots'), 'screenshots');

  const shotCount = readdirSync(join(output, 'screenshots')).filter((n) => !n.startsWith('.')).length;
  if (shotCount < 3) fail(`only ${shotCount} screenshot(s) in screenshots/: the entry needs at least 3`);

  // The dossier is written last, from exactly what the run just wrote.
  const dossier = buildDossier(output, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4194304 },
  });
  writeFileSync(join(output, 'dossier.json'), dossier);
  console.log(`token-radar: ${board.length} rows, top implied $${board[0]!.implied_value_usd}, wrote ${output}`);
}

main();
