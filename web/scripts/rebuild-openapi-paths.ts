/**
 * Rebuild openapi.ts paths section (Phase 2.2, final).
 *
 * Strategy:
 * 1. Read the original openapi.ts (HEAD = commit 6ee1676 which has
 *    the 56 hand-written path entries with rich schemas).
 * 2. Extract those 56 path entries by parsing the file.
 * 3. Read the generated file (900 lines, one block per path).
 * 4. For each generated block:
 *    - If the path already exists in the hand-written set, merge:
 *      add methods that the hand-written entry does not have.
 *    - Otherwise, add the generated block as-is.
 * 5. Write the merged result back into openapi.ts at the same
 *    paths section.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const OPENAPI_TS = path.join(ROOT, 'src', 'contracts', 'openapi.ts');
const GENERATED_FILE = path.join(ROOT, '..', 'docs', 'audits', 'generated-openapi-entries-clean.txt');

function extractAllPathBlocks(src: string, startIdx: number): { key: string; start: number; end: number }[] {
  const out: { key: string; start: number; end: number }[] = [];
  // Match a path entry: exactly 6-space indent + `'/api/...': {`.
  // The `^` with the m flag matches after every newline.
  const re = /^      '([^']+)': \{/gm;
  re.lastIndex = startIdx;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const key = m[1];
    if (!key.startsWith('/api/')) {
      continue;
    }
    // Walk braces to find the matching `}`.
    // The opening `{` is at m.index + m[0].length - 1.
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    out.push({ key, start: m.index, end: i });
    re.lastIndex = i;
  }
  return out;
}

function extractMethodsFromBlock(block: string): Set<string> {
  const out = new Set<string>();
  const re = /^\s*(get|post|put|delete|patch)\s*:/gm;
  let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
    out.add(m[1]);
  }
  return out;
}

function main(): void {
  const src = fs.readFileSync(OPENAPI_TS, 'utf8');
  const generated = fs.readFileSync(GENERATED_FILE, 'utf8').replace(/^\uFEFF/, '');

  // 1. Find the original paths section boundaries.
  // Strip BOM if present (some files have a UTF-8 BOM that breaks
  // the regex matching).
  const cleanSrc = src.replace(/^\uFEFF/, '');
  const startRe = /    paths: \{/;
  const startMatch = startRe.exec(cleanSrc);
  if (!startMatch) {
    console.error('Could not find paths section');
    process.exit(1);
  }
  const startIdx = startMatch.index + startMatch[0].length;
  const working = cleanSrc;
  // Find the matching `    },` that closes paths. The next occurrence
  // at column 4 after the start.
  const closeRe = /\n    \},\n    components: \{/;
  const closeMatch = closeRe.exec(src.slice(startIdx));
  if (!closeMatch) {
    console.error('Could not find paths->components boundary');
    process.exit(1);
  }
  const endIdx = startIdx + closeMatch.index;

  // 2. Extract hand-written path blocks.
  const handWritten = extractAllPathBlocks(src, startIdx);
  const handWrittenMap = new Map<string, { start: number; end: number }>();
  for (const b of handWritten) {
    handWrittenMap.set(b.key, { start: b.start, end: b.end });
  }
  console.log(`Hand-written path blocks: ${handWrittenMap.size}`);

  // 3. Extract generated path blocks.
  const generatedBlocks = extractAllPathBlocks(generated, 0);
  const generatedMap = new Map<string, { start: number; end: number }>();
  for (const b of generatedBlocks) {
    generatedMap.set(b.key, { start: b.start, end: b.end });
  }
  console.log(`Generated path blocks: ${generatedMap.size}`);

  // 4. For each generated path, decide what to do.
  const additions: string[] = [];
  const merges: { key: string; newMethods: string }[] = [];
  for (const [key, genRange] of generatedMap.entries()) {
    const genBlock = generated.slice(genRange.start, genRange.end);
    const genMethods = extractMethodsFromBlock(genBlock);
    const hwRange = handWrittenMap.get(key);
    if (!hwRange) {
      additions.push(genBlock);
      continue;
    }
    // Merge: add methods that the hand-written entry is missing.
    const hwBlock = working.slice(hwRange.start, hwRange.end);
    const hwMethods = extractMethodsFromBlock(hwBlock);
    const newMethodBlocks: string[] = [];
    const methodRe = /^\s*(get|post|put|delete|patch)\s*:\s*\{/gm;
    let mm: RegExpExecArray | null;
    while ((mm = methodRe.exec(genBlock)) !== null) {
      const method = mm[1];
      if (hwMethods.has(method)) continue;
      let depth = 1;
      let j = mm.index + mm[0].length;
      while (j < genBlock.length && depth > 0) {
        const ch = genBlock[j];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        j++;
      }
      const methodBlock = genBlock.slice(mm.index, j);
      // The generated method block already uses 8-space indent
      // (matching the hand-written entries), so we can append it
      // as-is.
      newMethodBlocks.push(methodBlock);
    }
    if (newMethodBlocks.length > 0) {
      // Each method block needs a trailing comma when followed by
      // another method. We append a comma to every block in the
      // merge list.
      const joined = newMethodBlocks
        .map((b) => b.replace(/}\s*$/, '},'))
        .join('\n        ');
      // Insert the new methods just before the closing `}` of the
      // hand-written block. The `joined` string already ends with
      // a comma, so we don't need a separator.
      const before = hwBlock.slice(0, -1); // block without trailing `}`
      const after = hwBlock.slice(-1);     // the `}`
      const mergedBlock = before + '\n        ' + joined + after;
      merges.push({ key, newMethods: mergedBlock });
    }
  }

  // 5. Build the new paths section.
  // Start with all hand-written blocks (preserved as-is), but
  // replace merged ones with the merged version.
  const newPathsLines: string[] = [];
  // Track keys we've already added to avoid duplicates.
  const addedKeys = new Set<string>();
  for (const b of handWritten) {
    if (addedKeys.has(b.key)) continue;
    const merge = merges.find((m) => m.key === b.key);
    if (merge) {
      newPathsLines.push(merge.newMethods);
    } else {
      newPathsLines.push(working.slice(b.start, b.end));
    }
    addedKeys.add(b.key);
  }
  // Now add the generated blocks for keys not in hand-written.
  for (const key of addedKeys.values()) {
    // no-op: already added
  }
  for (const [key, genRange] of generatedMap.entries()) {
    if (addedKeys.has(key)) continue;
    newPathsLines.push(generated.slice(genRange.start, genRange.end));
    addedKeys.add(key);
  }
  // Each block in newPathsLines already starts at the 6-space
  // indent (e.g. `      '/api/admin/riders': {`). Join with just
  // `,\n` so the result is a comma-separated list at the same indent.
  const newPathsBody = newPathsLines.join(',\n');

  // 6. Replace the paths section.
  const newSrc =
    src.slice(0, startIdx) +
    '\n      ' +
    newPathsBody +
    ',\n    },\n    components: {' +
    src.slice(endIdx + '\n    },\n    components: {'.length);

  fs.writeFileSync(OPENAPI_TS, newSrc);
  console.log(`Rebuilt paths: ${addedKeys.size} unique keys`);
  console.log(`Merged: ${merges.length} paths got additional methods`);
  console.log(`Added: ${additions.length} new paths`);
}

main();
