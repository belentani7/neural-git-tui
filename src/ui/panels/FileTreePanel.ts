import { GitFileChange, GitDiff } from '../../git/types.js';
import { THEME } from '../../utils/theme.js';
import { padRight, neonText, mutedText, secondaryText, goldText, cyanText, styleText, trueColor, resetColor, successText, errorText, warningText } from '../../utils/theme.js';

export interface FileTreePanelProps {
  width: number;
  height: number;
  diff: GitDiff | null;
}

export function renderFileTreePanel(props: FileTreePanelProps): string[] {
  const { width, height, diff } = props;
  const lines: string[] = [];
  const innerWidth = width - 4;

  lines.push(renderTitleBar(width, 'FILE CHANGES', THEME.colors.cyan));
  lines.push('');

  if (!diff || diff.files.length === 0) {
    lines.push(padRight(center(mutedText('No file changes'), innerWidth), innerWidth));
    lines.push(padRight(center(mutedText('Select a commit to view diff'), innerWidth), innerWidth));
  } else {
    lines.push(padRight(`${neonText('Total:')} ${goldText(diff.stats.totalFiles.toString())} files, ${successText(`+${diff.stats.totalAdditions}`)} ${errorText(`-${diff.stats.totalDeletions}`)}`, innerWidth));
    lines.push('');

    const maxFiles = height - 8;
    const visibleFiles = diff.files.slice(0, maxFiles);

    for (const file of visibleFiles) {
      const statusIcon = getStatusIcon(file.status);
      const statusColor = getStatusColor(file.status);
      const path = truncate(file.path, innerWidth - 15);
      const stats = file.additions > 0 || file.deletions > 0
        ? ` ${successText(`+${file.additions}`)} ${errorText(`-${file.deletions}`)}`
        : '';

      lines.push(padRight(`${statusIcon} ${path}${stats}`, innerWidth));
    }

    if (diff.files.length > maxFiles) {
      lines.push(padRight(mutedText(`... and ${diff.files.length - maxFiles} more files`), innerWidth));
    }
  }

  while (lines.length < height - 2) {
    lines.push(' '.repeat(innerWidth));
  }

  lines.push(renderBottomBar(width));

  return lines.map(line => `│ ${line} │`);
}

function getStatusIcon(status: GitFileChange['status']): string {
  switch (status) {
    case 'added': return successText('✚');
    case 'deleted': return errorText('✖');
    case 'modified': return warningText('●');
    case 'renamed': return goldText('→');
    case 'copied': return cyanText('⎘');
    default: return mutedText('?');
  }
}

function getStatusColor(status: GitFileChange['status']): string {
  switch (status) {
    case 'added': return THEME.colors.fileAdd;
    case 'deleted': return THEME.colors.fileDelete;
    case 'modified': return THEME.colors.fileModify;
    default: return THEME.colors.textMuted;
  }
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

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + '…';
}