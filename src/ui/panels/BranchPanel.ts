import { NeuralNetwork } from '../../neural/types.js';
import { GitBranch } from '../../git/types.js';
import { THEME } from '../../utils/theme.js';
import { truncate, padRight, neonText, mutedText, secondaryText, goldText, cyanText, styleText, trueColor, resetColor } from '../../utils/theme.js';

export interface BranchPanelProps {
  width: number;
  height: number;
  branches: GitBranch[];
  currentBranch: string;
  network: NeuralNetwork | null;
}

export function renderBranchPanel(props: BranchPanelProps): string[] {
  const { width, height, branches, currentBranch, network } = props;
  const lines: string[] = [];
  const innerWidth = width - 4;

  lines.push(renderTitleBar(width, 'BRANCHES', THEME.colors.goldZion));
  lines.push('');

  const sortedBranches = [...branches].sort((a, b) => {
    if (a.isHead && !b.isHead) return -1;
    if (!a.isHead && b.isHead) return 1;
    return a.name.localeCompare(b.name);
  });

  const maxVisible = height - 6;
  const visibleBranches = sortedBranches.slice(0, maxVisible);

  for (const branch of visibleBranches) {
    const isCurrent = branch.name === currentBranch || branch.isHead;
    const prefix = isCurrent ? neonText('► ') : '  ';
    const name = isCurrent ? neonText(branch.name) : secondaryText(branch.name);
    const remote = branch.isRemote ? mutedText(' [remote]') : '';
    const sync = branch.ahead > 0 || branch.behind > 0
      ? ` ${goldText(`↑${branch.ahead}`)} ${styleText(`↓${branch.behind}`, THEME.colors.fileDelete)}`
      : mutedText(' ✓');

    lines.push(padRight(`${prefix}${name}${remote}${sync}`, innerWidth));
  }

  while (lines.length < height - 2) {
    lines.push(' '.repeat(innerWidth));
  }

  lines.push(renderBottomBar(width));

  return lines.map(line => `│ ${line} │`);
}

function renderTitleBar(width: number, title: string, color: string): string {
  const innerWidth = width - 4;
  return `${trueColor(color)}╭${'─'.repeat(innerWidth + 2)}╮${resetColor()}`;
}

function renderBottomBar(width: number): string {
  const innerWidth = width - 4;
  return `${trueColor(THEME.colors.glassBorder)}╰${'─'.repeat(innerWidth + 2)}╯${resetColor()}`;
}