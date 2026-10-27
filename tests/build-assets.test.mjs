import test from 'node:test';
import assert from 'node:assert/strict';

// A successful tsc alone is not sufficient: the compiled parser and UI
// import .mjs helpers which must also exist in dist on a clean checkout.
test('build includes runtime ESM helpers required by compiled modules', async () => {
  const { parseGitLog } = await import('../dist/git/parse-log.mjs');
  const { editSearchQuery } = await import('../dist/ui/interaction.mjs');
  assert.deepEqual(parseGitLog(''), []);
  assert.equal(editSearchQuery('neural', 'x', '!'), 'neural!');
});
