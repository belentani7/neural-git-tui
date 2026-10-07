import { NeuralNetwork, Neuron } from '../../neural/types.js';
import { GitCommit } from '../../git/types.js';
import { THEME } from '../../utils/theme.js';
import { padRight, truncate, neonText, mutedText, secondaryText, goldText, styleText, trueColor, resetColor } from '../../utils/theme.js';

export interface SearchResult {
  neuron: Neuron;
  score: number;
  matchType: 'hash' | 'message' | 'author' | 'date' | 'file';
}

export interface SearchPanelProps {
  width: number;
  height: number;
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  network: NeuralNetwork | null;
}

export function renderSearchPanel(props: SearchPanelProps): string[] {
  const { width, height, query, results, selectedIndex, network } = props;
  const lines: string[] = [];
  const innerWidth = width - 4;

  lines.push(renderTitleBar(width, 'SEARCH', THEME.colors.mergeGlow));
  lines.push('');

  const queryDisplay = query ? neonText(query) : mutedText('(empty - type to search)');
  lines.push(padRight(`${neonText('Query:')} ${queryDisplay}`, innerWidth));
  lines.push(padRight(`${neonText('Results:')} ${goldText(results.length.toString())}`, innerWidth));
  lines.push('');

  if (results.length === 0) {
    lines.push(padRight(center(mutedText(query ? 'No matches found' : 'Start typing to search commits'), innerWidth), innerWidth));
  } else {
    const maxResults = height - 8;
    const start = Math.max(0, selectedIndex - maxResults + 1);
    const visibleResults = results.slice(start, start + maxResults);

    for (let i = 0; i < visibleResults.length; i++) {
      const result = visibleResults[i];
      const actualIndex = start + i;
      const isSelected = actualIndex === selectedIndex;
      const prefix = isSelected ? neonText('► ') : '  ';
      const neuron = result.neuron;
      const commit = neuron.commit;

      const matchLabel = getMatchLabel(result.matchType);
      const shortHash = goldText(commit.shortHash);
      const message = truncate(highlightMatch(commit.message, query), innerWidth - 20);
      const author = mutedText(commit.authorName);

      lines.push(padRight(`${prefix}${shortHash} ${message} ${author} ${matchLabel}`, innerWidth));
    }

    if (results.length > maxResults) {
      lines.push(padRight(mutedText(`... ${results.length - maxResults} more results (↑/↓ to navigate)`), innerWidth));
    }
  }

  lines.push('');
  lines.push(padRight(mutedText('Enter: select  Esc: clear  ↑↓: navigate'), innerWidth));

  while (lines.length < height - 2) {
    lines.push(' '.repeat(innerWidth));
  }

  lines.push(renderBottomBar(width));

  return lines.map(line => `│ ${line} │`);
}

function getMatchLabel(type: SearchResult['matchType']): string {
  switch (type) {
    case 'hash': return styleText('[hash]', THEME.colors.cyan);
    case 'message': return styleText('[msg]', THEME.colors.goldZion);
    case 'author': return styleText('[author]', THEME.colors.cyan);
    case 'date': return styleText('[date]', THEME.colors.goldZion);
    case 'file': return styleText('[file]', THEME.colors.mergeGlow);
  }
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, match => styleText(match, THEME.colors.neonRed));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderTitleBar(width: number, title: string, color: string): string {
  const innerWidth = width - 4;
  return `${trueColor(color)}╭${'─'.repeat(innerWidth + 2)}╮${resetColor()}`;
}

function renderBottomBar(width: number): string {
  const innerWidth = width - 4;
  return `${trueColor(THEME.colors.glassBorder)}╰${'─'.repeat(innerWidth + 2)}╯${resetColor()}`;
}

function center(text: string, width: number): string {
  const padding = Math.max(0, width - text.length);
  const left = Math.floor(padding / 2);
  return ' '.repeat(left) + text;
}

export function searchCommits(network: NeuralNetwork, query: string): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const neuron of network.neurons.values()) {
    const commit = neuron.commit;
    let score = 0;
    let matchType: SearchResult['matchType'] = 'message';

    if (commit.hash.toLowerCase().includes(lowerQuery)) {
      score += 100;
      matchType = 'hash';
    }
    if (commit.shortHash.toLowerCase().includes(lowerQuery)) {
      score += 80;
      matchType = 'hash';
    }
    if (commit.message.toLowerCase().includes(lowerQuery)) {
      score += 50;
      matchType = 'message';
    }
    if (commit.authorName.toLowerCase().includes(lowerQuery)) {
      score += 40;
      matchType = 'author';
    }
    if (commit.authorEmail.toLowerCase().includes(lowerQuery)) {
      score += 30;
      matchType = 'author';
    }
    if (commit.authorDate.toISOString().includes(lowerQuery)) {
      score += 20;
      matchType = 'date';
    }

    if (score > 0) {
      results.push({ neuron, score, matchType });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}