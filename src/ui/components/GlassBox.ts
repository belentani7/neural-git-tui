import { THEME, styleText, trueColor, resetColor, neonText, mutedText, secondaryText, goldText, cyanText, successText, errorText, warningText, truncate, padRight, padLeft, center, progressBar, sparkline } from '../../utils/theme.js';

export interface GlassBoxProps {
  width: number;
  height: number;
  title?: string;
  borderColor?: string;
  bgOpacity?: number;
}

export function renderGlassBox(props: GlassBoxProps): string[] {
  const { width, height, title, borderColor = THEME.colors.glassBorder, bgOpacity = 0.03 } = props;
  const lines: string[] = [];
  const innerWidth = width - 2;
  const innerHeight = height - 2;

  const borderFg = trueColor(borderColor);
  const bg = trueColor(THEME.colors.void, true);
  const reset = resetColor();

  const tl = '┌';
  const tr = '┐';
  const bl = '└';
  const br = '┘';
  const h = '─';
  const v = '│';

  const topBorder = borderFg + tl + h.repeat(innerWidth) + tr + reset;
  const bottomBorder = borderFg + bl + h.repeat(innerWidth) + br + reset;

  lines.push(topBorder);

  if (title) {
    const titleLine = borderFg + v + reset + ' ' + styleText(title, THEME.colors.neonRed) + ' '.repeat(innerWidth - title.length - 1) + borderFg + v + reset;
    lines.push(titleLine);
    lines.push(borderFg + v + ' '.repeat(innerWidth) + v + reset);
  }

  for (let i = title ? 2 : 1; i < innerHeight; i++) {
    lines.push(borderFg + v + reset + ' '.repeat(innerWidth) + borderFg + v + reset);
  }

  lines.push(bottomBorder);

  return lines;
}

export function renderGlassBoxContent(
  props: GlassBoxProps,
  content: string[],
  startY: number = 1
): string[] {
  const box = renderGlassBox(props);
  const innerWidth = props.width - 2;
  const borderFg = trueColor(props.borderColor || THEME.colors.glassBorder);
  const v = '│';
  const reset = resetColor();

  const result = [...box];

  for (let i = 0; i < content.length && startY + i < box.length - 1; i++) {
    const lineIdx = startY + i;
    const line = content[i];
    const padded = line.length > innerWidth
      ? line.substring(0, innerWidth)
      : line + ' '.repeat(innerWidth - line.length);
    result[lineIdx] = borderFg + v + reset + padded + borderFg + v + reset;
  }

  return result;
}

export { neonText, mutedText, secondaryText, goldText, cyanText, successText, errorText, warningText, truncate, padRight, padLeft, center, progressBar, sparkline };