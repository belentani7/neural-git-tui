import { NeuralNetwork, Neuron } from '../../neural/types.js';
import { GitCommit } from '../../git/types.js';
import { THEME } from '../../utils/theme.js';
import { truncate, padRight, center, neonText, mutedText, secondaryText, goldText, cyanText, styleText, trueColor, resetColor } from '../../utils/theme.js';

export interface CommitPanelProps {
  width: number;
  height: number;
  neuron: Neuron | null;
  network: NeuralNetwork | null;
}

export function renderCommitPanel(props: CommitPanelProps): string[] {
  const { width, height, neuron, network } = props;
  const lines: string[] = [];

  if (!neuron) {
    return renderEmptyPanel(width, height, 'No commit selected', 'Press Enter on a neuron to view details');
  }

  const commit = neuron.commit;
  const innerWidth = width - 4;

  lines.push(renderTitleBar(width, 'COMMIT DETAILS', THEME.colors.neonRed));
  lines.push('');

  lines.push(padRight(`${neonText('Hash:')} ${secondaryText(commit.hash)}`, innerWidth));
  lines.push(padRight(`${neonText('Short:')} ${goldText(commit.shortHash)}`, innerWidth));
  lines.push('');

  lines.push(padRight(`${neonText('Type:')} ${getTypeBadge(neuron.type)}`, innerWidth));
  lines.push('');

  lines.push(padRight(`${neonText('Author:')} ${commit.authorName} ${mutedText(`<${commit.authorEmail}>`)}`, innerWidth));
  lines.push(padRight(`${neonText('Date:')} ${commit.authorDate.toLocaleString()}`, innerWidth));
  lines.push('');

  if (commit.refs.length > 0) {
    lines.push(padRight(`${neonText('Refs:')} ${commit.refs.map(r => cyanText(r)).join(', ')}`, innerWidth));
    lines.push('');
  }

  lines.push(padRight(`${neonText('Parents:')} ${commit.parents.length > 0 ? commit.parents.map(p => goldText(p.substring(0, 7))).join(' → ') : mutedText('(root commit)')}`, innerWidth));
  lines.push('');

  lines.push(renderSectionHeader(innerWidth, 'MESSAGE'));
  const msgLines = wrapText(commit.message, innerWidth);
  for (const msgLine of msgLines) {
    lines.push(padRight(msgLine, innerWidth));
  }

  if (commit.body) {
    lines.push('');
    lines.push(renderSectionHeader(innerWidth, 'BODY'));
    const bodyLines = wrapText(commit.body, innerWidth);
    for (const bodyLine of bodyLines.slice(0, height - lines.length - 5)) {
      lines.push(padRight(bodyLine, innerWidth));
    }
  }

  lines.push('');
  lines.push(renderSectionHeader(innerWidth, 'STATS'));
  lines.push(padRight(`${neonText('Connections:')} ${neuron.connections.length} synapses`, innerWidth));
  lines.push(padRight(`${neonText('Activation:')} ${Math.round(neuron.activation * 100)}%`, innerWidth));
  lines.push(padRight(`${neonText('Charge:')} ${neuron.charge.toFixed(1)}`, innerWidth));

  while (lines.length < height - 2) {
    lines.push(' '.repeat(innerWidth));
  }

  lines.push(renderBottomBar(width));

  return lines.map(line => `│ ${line} │`);
}

function renderEmptyPanel(width: number, height: number, title: string, subtitle: string): string[] {
  const lines: string[] = [];
  const innerWidth = width - 4;
  const mid = Math.floor(height / 2);

  lines.push(renderTitleBar(width, 'COMMIT DETAILS', THEME.colors.neonRed));

  for (let i = 1; i < height - 2; i++) {
    if (i === mid - 1) {
      lines.push(padRight(center(title, innerWidth), innerWidth));
    } else if (i === mid) {
      lines.push(padRight(center(subtitle, innerWidth), innerWidth));
    } else {
      lines.push(' '.repeat(innerWidth));
    }
  }

  lines.push(renderBottomBar(width));
  return lines.map(line => `│ ${line} │`);
}

function renderTitleBar(width: number, title: string, color: string): string {
  const innerWidth = width - 4;
  const left = `╭${'─'.repeat(innerWidth + 2)}╮`;
  const right = `╰${'─'.repeat(innerWidth + 2)}╯`;
  return `${trueColor(color)}${left}${resetColor()}`;
}

function renderBottomBar(width: number): string {
  const innerWidth = width - 4;
  return `${trueColor(THEME.colors.glassBorder)}╰${'─'.repeat(innerWidth + 2)}╯${resetColor()}`;
}

function renderSectionHeader(width: number, title: string): string {
  return `${neonText(title)} ${mutedText('─'.repeat(Math.max(0, width - title.length - 1)))}`;
}

function getTypeBadge(type: string): string {
  switch (type) {
    case 'head': return `${neonText('● HEAD')}`;
    case 'merge': return `${goldText('◆ MERGE')}`;
    case 'root': return `${cyanText('◆ ROOT')}`;
    case 'tag': return `${styleText('◆ TAG', THEME.colors.mergeGlow)}`;
    default: return `${secondaryText('○ COMMIT')}`;
  }
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > width) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}