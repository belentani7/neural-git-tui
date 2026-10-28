import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
test('root commits diff against Git empty tree without parent^', t => {
  const dir = mkdtempSync(join(tmpdir(), 'neural-root-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();
  git('init', '-q');
  writeFileSync(join(dir, 'first.txt'), 'initial\n');
  git('add', 'first.txt');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'Root');
  const head = git('rev-parse', 'HEAD');
  const parents = git('rev-list', '--parents', '-n', '1', head).split(/\s+/).slice(1);
  assert.deepEqual(parents, []);
  const result = git('diff', '--numstat', parents[0] || EMPTY_TREE, head);
  assert.match(result, /^1\s+0\s+first\.txt$/);
});
