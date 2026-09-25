// checkTree.ts: checks that buildTree turns one exported game into a correct lila-style tree.
// Usage: npx tsx scripts/checkTree.ts [path/to/game.json]   (default: fixtures/game1.json)

import { readFileSync } from 'node:fs';
import { buildTree, mainline, nodeAtPath, type LichessGameJson, type TreeNode } from '../src/tree';

// Fields of the export that tree.ts ignores. The per-player counts are Lichess's own
// tally of judged moves, which gives us something independent to check against.
type Counts = { inaccuracy?: number; mistake?: number; blunder?: number };
type ExportJson = LichessGameJson & {
  variant?: string;
  players?: { white?: { analysis?: Counts }; black?: { analysis?: Counts } };
};

const file = process.argv[2] ?? 'fixtures/game1.json';
const game: ExportJson = JSON.parse(readFileSync(file, 'utf8'));

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

if (!game.analysis) console.warn('No analysis in this export (was it requested with evals=true?).');
if (game.variant && !['standard', 'chess960', 'fromPosition'].includes(game.variant))
  console.warn(`Variant "${game.variant}": tree.ts uses standard chess rules.`);

let root: TreeNode;
try {
  root = buildTree(game);
} catch (e) {
  // buildTree throws when a game move or engine move is illegal where it's played
  console.log(`buildTree failed: ${(e as Error).message}`);
  process.exit(1);
}
const sans = game.moves.split(' ').filter(san => san !== '');
const line = mainline(root);
const onMainline = new Set(line);

// 1. The mainline is exactly the game.
if (line.length !== sans.length + 1) fail(`mainline has ${line.length - 1} moves; the game has ${sans.length}`);
sans.forEach((san, i) => {
  if (line[i + 1]?.san !== san) fail(`move ${i + 1}: mainline has ${line[i + 1]?.san}, the game has ${san}`);
});
if ((game.analysis?.length ?? 0) > sans.length)
  fail(`analysis has ${game.analysis!.length} entries for ${sans.length} moves`);

// 2. Every node, including engine lines, is well formed and reachable by its path.
let nodeCount = 0;
// branchPly: for a node on an engine line, the ply of the mainline node the line hangs off.
function walk(node: TreeNode, path: string, parent?: TreeNode, branchPly?: number): void {
  nodeCount++;
  const isMain = onMainline.has(node);
  const startsEngineLine = !isMain && !!parent && onMainline.has(parent);
  if (startsEngineLine) branchPly = parent.ply;
  const where = `ply ${node.ply} ${node.san ?? '(root)'}${isMain ? '' : ` (engine line from ply ${branchPly})`}`;

  if (parent && node.ply !== parent.ply + 1) fail(`${where}: ply should be ${parent.ply + 1}`);
  if (parent && node.id.length !== 2) fail(`${where}: id "${node.id}" is not 2 characters`);
  try {
    if (nodeAtPath(root, path) !== node) fail(`${where}: nodeAtPath finds a different node`);
  } catch (e) {
    fail(`${where}: ${(e as Error).message}`);
  }
  const ids = node.children.map(c => c.id);
  if (new Set(ids).size !== ids.length) fail(`${where}: two children share an id`);
  if (node.children.filter(c => c.comp).length > 1) fail(`${where}: more than one engine line`);

  // comp marks only the first node of an engine line; engine lines carry no evals.
  if (startsEngineLine && !node.comp) fail(`${where}: first node of an engine line is not comp`);
  if (!startsEngineLine && node.comp) fail(`${where}: comp on a node that doesn't start an engine line`);
  if (!isMain && node.eval) fail(`${where}: engine-line node has an eval`);

  node.children.forEach(child => walk(child, path + child.id, node, branchPly));
}
walk(root, '');

// 3. Evals, judgments, and engine lines line up with the analysis entries.
const counts = {
  white: { inaccuracy: 0, mistake: 0, blunder: 0 },
  black: { inaccuracy: 0, mistake: 0, blunder: 0 },
};
let judged = 0;
let withoutLine = 0;
sans.forEach((_, i) => {
  const node = line[i + 1];
  const parent = line[i];
  const entry = game.analysis?.[i];
  if (!node) return; // already reported by check 1
  const where = `ply ${node.ply} ${node.san}`;

  const entryHasEval = entry?.eval !== undefined || entry?.mate !== undefined;
  if (entryHasEval !== !!node.eval) fail(`${where}: eval is ${JSON.stringify(node.eval)}, entry is ${JSON.stringify(entry)}`);

  const judgment = entry?.judgment;
  if (!!judgment !== !!node.glyphs?.length) {
    fail(`${where}: glyphs don't match the entry's judgment`);
    return;
  }
  if (!judgment) return;

  judged++;
  const color = node.ply % 2 === 1 ? 'white' : 'black'; // White's moves land on odd plies
  counts[color][judgment.name.toLowerCase() as keyof Counts]++;

  const engineStart = parent.children.find(c => c.comp);
  if (!engineStart) {
    withoutLine++;
    console.warn(`${where}: judged ${judgment.name} but has no engine line; retrospect must skip it.`);
    return;
  }
  // Lichess's comment names the best move, e.g. "Mistake. Nf6 was best."
  if (!judgment.comment.includes(`${engineStart.san} was best`))
    fail(`${where}: engine line starts with ${engineStart.san}, but the comment says "${judgment.comment}"`);
  console.log(`  ${where}${node.glyphs![0].symbol}  engine line from ply ${parent.ply}: ${engineLine(engineStart)}`);
});

// 4. Judgment counts match Lichess's per-player summary.
for (const color of ['white', 'black'] as const) {
  const expected = game.players?.[color]?.analysis;
  if (!expected) {
    console.warn(`No ${color} analysis summary in this export; skipped the ${color} count check.`);
    continue;
  }
  for (const kind of ['inaccuracy', 'mistake', 'blunder'] as const) {
    if ((expected[kind] ?? 0) !== counts[color][kind])
      fail(`${color} ${kind} count: tree has ${counts[color][kind]}, Lichess says ${expected[kind] ?? 0}`);
  }
}

function engineLine(start: TreeNode): string {
  const moves: string[] = [];
  for (let n: TreeNode | undefined = start; n; n = n.children[0]) moves.push(n.san!);
  return moves.join(' ');
}

console.log(
  `${file}: ${sans.length} moves, ${nodeCount} nodes, ${judged} judged moves (${withoutLine} without an engine line)`,
);
if (failures.length) {
  console.log(`${failures.length} FAILED:`);
  failures.forEach(f => console.log(`  ${f}`));
  process.exitCode = 1;
} else console.log('All checks passed.');