export interface TerminalCapabilities {
  trueColor: boolean;
  color256: boolean;
  unicode: boolean;
  width: number;
  height: number;
  isTTY: boolean;
  program: string;
}

export function detectCapabilities(): TerminalCapabilities {
  const env = process.env;
  const stdout = process.stdout;

  const trueColor = !!(
    env.COLORTERM === 'truecolor' ||
    env.COLORTERM === '24bit' ||
    env.TERM_PROGRAM === 'vscode' ||
    env.TERM_PROGRAM === 'Terminus' ||
    env.TERM_PROGRAM === 'Hyper' ||
    env.TERM_PROGRAM === 'iTerm.app' ||
    env.TERM === 'xterm-256color' ||
    env.TERM === 'screen-256color' ||
    env.TERM === 'tmux-256color'
  );

  const color256 = trueColor || !!(
    env.TERM?.includes('256color') ||
    env.TERM === 'screen' ||
    env.TERM === 'xterm' ||
    env.COLORTERM
  );

  const unicode = !(
    env.TERM === 'dumb' ||
    env.NO_UNICODE === '1' ||
    process.platform === 'win32' && !env.WT_SESSION && !env.TERM_PROGRAM
  );

  return {
    trueColor,
    color256,
    unicode,
    width: stdout.columns || 80,
    height: stdout.rows || 24,
    isTTY: stdout.isTTY,
    program: env.TERM_PROGRAM || env.TERM || 'unknown',
  };
}

export function supportsTrueColor(): boolean {
  return detectCapabilities().trueColor;
}

export function supports256Color(): boolean {
  return detectCapabilities().color256;
}

export function supportsUnicode(): boolean {
  return detectCapabilities().unicode;
}

export function getTerminalSize(): { width: number; height: number } {
  const caps = detectCapabilities();
  return { width: caps.width, height: caps.height };
}

export function onResize(callback: (size: { width: number; height: number }) => void): () => void {
  const handler = () => callback(getTerminalSize());
  process.stdout.on('resize', handler);
  return () => process.stdout.off('resize', handler);
}

export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

export function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

export function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

export function moveCursor(x: number, y: number): void {
  process.stdout.write(`\x1b[${y + 1};${x + 1}H`);
}

export function saveCursor(): void {
  process.stdout.write('\x1b[s');
}

export function restoreCursor(): void {
  process.stdout.write('\x1b[u');
}

export function eraseLine(): void {
  process.stdout.write('\x1b[2K');
}

export function eraseDown(): void {
  process.stdout.write('\x1b[J');
}

export function setTitle(title: string): void {
  process.stdout.write(`\x1b]0;${title}\x07`);
}

export function enableMouse(): void {
  process.stdout.write('\x1b[?1000h\x1b[?1002h\x1b[?1003h');
}

export function disableMouse(): void {
  process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1003l');
}

export function enableAlternateScreen(): void {
  process.stdout.write('\x1b[?1049h');
}

export function disableAlternateScreen(): void {
  process.stdout.write('\x1b[?1049l');
}

export function rawMode(enabled: boolean): void {
  if (process.stdin.isTTY) {
    if (enabled) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    } else {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }
}