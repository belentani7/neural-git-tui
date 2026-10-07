export const THEME = {
  colors: {
    void: '#000000',
    neonRed: '#ff073a',
    goldZion: '#d4af37',
    cyan: '#4de8e0',
    glassBg: 'rgba(255,255,255,0.03)',
    glassBorder: 'rgba(255,255,255,0.08)',
    glassHover: 'rgba(255,255,255,0.06)',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textGhost: '#3f3f46',
    synapseActive: '#ff073a',
    synapseResting: '#3f3f46',
    synapseDim: '#1a1a2e',
    neuronActive: '#ff073a',
    neuronResting: '#4de8e0',
    neuronDim: '#2a2a3e',
    branchHighlight: '#d4af37',
    mergeGlow: '#a855f7',
    fileAdd: '#10b981',
    fileDelete: '#ef4444',
    fileModify: '#f59e0b',
  },

  chars: {
    shades: {
      light: '░',
      medium: '▒',
      dark: '▓',
      full: '█',
    },
    box: {
      tl: '┌', tr: '┐', bl: '└', br: '┘',
      h: '─', v: '│',
      teeT: '┬', teeB: '┴', teeL: '├', teeR: '┤',
      cross: '┼',
    },
    doubleBox: {
      tl: '╔', tr: '╗', bl: '╚', br: '╝',
      h: '═', v: '║',
      teeT: '╦', teeB: '╩', teeL: '╠', teeR: '╣',
      cross: '╬',
    },
    neuron: {
      tiny: '·',
      small: '●',
      medium: '◉',
      large: '◎',
      huge: '⬤',
      pulse: ['·', '●', '◉', '◎', '⬤', '◎', '◉', '●'],
    },
    synapse: {
      h: '═', v: '║',
      tl: '╔', tr: '╗', bl: '╚', br: '╝',
      teeT: '╦', teeB: '╩', teeL: '╠', teeR: '╣',
      cross: '╬',
      diagTL: '╲', diagTR: '╱', diagBL: '╱', diagBR: '╲',
    },
    firing: ['⚡', '✦', '✧', '★', '☆', '✶', '✷', '✸', '✹'],
    signal: ['→', '⇒', '⟶', '⟹', '~~>', '~~>>'],
    arrow: { up: '↑', down: '↓', left: '←', right: '→' },
    ui: {
      checkboxOn: '☑', checkboxOff: '☐',
      radioOn: '◉', radioOff: '○',
      expand: '▼', collapse: '▶',
      pin: '📌', tag: '🏷️', clock: '🕐',
      user: '👤', file: '📄', folder: '📁',
      search: '🔍', filter: '🔎',
    },
  },

  animation: {
    fps: 60,
    neuronPulseSpeed: 1.2,
    synapseFlowSpeed: 0.8,
    firingDuration: 800,
    signalTravelSpeed: 300,
    panelFadeIn: 200,
    panelFadeOut: 150,
  },

  layout: {
    repulsion: 50,
    attraction: 0.1,
    damping: 0.9,
    minDistance: 3,
    maxDistance: 15,
  },

  git: {
    maxCommits: 5000,
    shallowClone: false,
    fetchAll: true,
  },

  accessibility: {
    reducedMotion: false,
    highContrast: false,
    noUnicode: false,
  },
} as const;

export type Theme = typeof THEME;

export function getTheme(overrides?: Partial<Theme>): Theme {
  return { ...THEME, ...overrides };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbToAnsi256(r: number, g: number, b: number): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);
}

export function ansiColor(hex: string, bg = false): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  const code = rgbToAnsi256(rgb.r, rgb.g, rgb.b);
  return `\x1b[${bg ? 48 : 38};5;${code}m`;
}

export function trueColor(hex: string, bg = false): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  return `\x1b[${bg ? 48 : 38};2;${rgb.r};${rgb.g};${rgb.b}m`;
}

export function resetColor(): string {
  return '\x1b[0m';
}

export function styleText(text: string, hex: string, bg = false): string {
  return `${trueColor(hex, bg)}${text}${resetColor()}`;
}

export function neonText(text: string, color: string = THEME.colors.neonRed): string {
  return styleText(text, color);
}

export function mutedText(text: string): string {
  return styleText(text, THEME.colors.textMuted);
}

export function secondaryText(text: string): string {
  return styleText(text, THEME.colors.textSecondary);
}

export function goldText(text: string): string {
  return styleText(text, THEME.colors.goldZion);
}

export function cyanText(text: string): string {
  return styleText(text, THEME.colors.cyan);
}

export function successText(text: string): string {
  return styleText(text, THEME.colors.fileAdd);
}

export function errorText(text: string): string {
  return styleText(text, THEME.colors.fileDelete);
}

export function warningText(text: string): string {
  return styleText(text, THEME.colors.fileModify);
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + '…';
}

export function padRight(text: string, len: number): string {
  return text + ' '.repeat(Math.max(0, len - text.length));
}

export function padLeft(text: string, len: number): string {
  return ' '.repeat(Math.max(0, len - text.length)) + text;
}

export function center(text: string, len: number): string {
  const padding = Math.max(0, len - text.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

export function progressBar(current: number, total: number, width: number, color: string = THEME.colors.neonRed): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const filledChar = '█';
  const emptyChar = '░';
  return trueColor(color) + filledChar.repeat(filled) + resetColor() + trueColor(THEME.colors.glassBorder) + emptyChar.repeat(empty) + resetColor();
}

export function sparkline(data: number[], width: number, color: string = THEME.colors.neonRed): string {
  if (data.length === 0) return ' '.repeat(width);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const chars = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const step = data.length / width;
  let result = '';
  for (let i = 0; i < width; i++) {
    const idx = Math.min(Math.floor(i * step), data.length - 1);
    const normalized = (data[idx] - min) / range;
    const charIdx = Math.min(Math.floor(normalized * (chars.length - 1)), chars.length - 1);
    result += trueColor(color) + chars[charIdx] + resetColor();
  }
  return result;
}