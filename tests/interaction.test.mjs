import test from 'node:test';
import assert from 'node:assert/strict';
import { editSearchQuery, nextNeuronId } from '../src/ui/interaction.mjs';

const neurons = new Map([
  ['center', { id: 'center', position: { x: 0, y: 0 } }],
  ['right', { id: 'right', position: { x: 5, y: 0 } }],
  ['left', { id: 'left', position: { x: -5, y: 0 } }],
  ['up', { id: 'up', position: { x: 0, y: -4 } }],
  ['down', { id: 'down', position: { x: 0, y: 4 } }],
]);

test('directional navigation picks spatial neighbors', () => {
  for (const direction of ['up', 'down', 'left', 'right'])
    assert.equal(nextNeuronId(neurons, 'center', direction), direction);
});
test('navigation handles empty graphs, missing focus, and edges', () => {
  assert.equal(nextNeuronId(new Map(), null, 'up'), null);
  assert.equal(nextNeuronId(neurons, 'missing', 'right'), 'right');
  assert.equal(nextNeuronId(neurons, 'right', 'right'), 'right');
});
test('search typing and backspace preserve Unicode code points', () => {
  assert.equal(editSearchQuery('ab', 'x', 'c'), 'abc');
  assert.equal(editSearchQuery('a🦊', 'backspace', undefined), 'a');
  assert.equal(editSearchQuery('', 'space', ' '), ' ');
});
test('search ignores terminal control sequences and caps input', () => {
  assert.equal(editSearchQuery('safe', 'escape', '\x1b'), 'safe');
  assert.equal(editSearchQuery('safe', 'return', '\n'), 'safe');
  assert.equal(editSearchQuery('x'.repeat(120), 'a', 'a'), 'x'.repeat(120));
});
