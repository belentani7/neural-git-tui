/** Pure keyboard editing and directional focus helpers for the terminal UI. */
export function editSearchQuery(query, keyName, character, limit = 120) {
  if (keyName === 'backspace') return Array.from(query).slice(0, -1).join('');
  if (typeof character !== 'string' || !character ||
      Array.from(character).some(c => /[\x00-\x1f\x7f]/u.test(c))) return query;
  return Array.from(query + character).slice(0, limit).join('');
}

/** Return the closest neuron in the requested screen direction, or the current one. */
export function nextNeuronId(neurons, currentId, direction) {
  const values = Array.from(neurons.values());
  if (!values.length) return null;
  const current = neurons.get(currentId) ?? values[0];
  const axes = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const axis = axes[direction];
  if (!axis) return current.id;
  let best = null;
  let bestScore = Infinity;
  for (const candidate of values) {
    if (candidate.id === current.id) continue;
    const dx = candidate.position.x - current.position.x;
    const dy = candidate.position.y - current.position.y;
    const forward = dx * axis[0] + dy * axis[1];
    if (forward <= 0.01) continue;
    const lateral = Math.abs(dx * axis[1] - dy * axis[0]);
    const score = forward + lateral * 2 + lateral * lateral / Math.max(forward, 1);
    if (score < bestScore) { best = candidate; bestScore = score; }
  }
  return best?.id ?? current.id;
}
