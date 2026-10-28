/** Parse NUL-delimited Git metadata without interpreting commit text as framing. */
export function parseGitLog(output) {
  if (typeof output !== 'string') throw new TypeError('Git log output must be text');
  if (!output.trim()) return [];
  const commits = [];
  // Git rejects NUL bytes in commit messages. The old ASCII RS/US framing
  // truncated otherwise valid commit bodies containing those characters.
  for (const raw of output.split('\x00\x00')) {
    if (!raw.trim()) continue;
    const record = {};
    for (const field of raw.split('\x00')) {
      const colon = field.indexOf(':');
      if (colon < 0) continue;
      const key = field.slice(0, colon).trim();
      const value = field.slice(colon + 1);
      if (key === 'parents') record.parents = value ? value.split(/\s+/).filter(Boolean) : [];
      else if (key === 'refs') record.refs = value ? value.split(', ').filter(Boolean) : [];
      else if (key === 'authorDate' || key === 'committerDate') record[key] = new Date(value);
      else if (['hash', 'shortHash', 'message', 'authorName', 'authorEmail',
                'committerName', 'committerEmail', 'body'].includes(key)) record[key] = value;
    }
    if (!/^[0-9a-f]{40,64}$/i.test(record.hash || '')) continue;
    record.body = (record.body || '').trim();
    record.parents ||= [];
    record.refs ||= [];
    commits.push(record);
  }
  return commits;
}
