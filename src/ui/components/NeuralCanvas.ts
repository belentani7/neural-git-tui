import blessed, { Widgets } from 'blessed';
import { NeuralNetwork, Neuron, Synapse } from '../../neural/types.js';
import { THEME } from '../../utils/theme.js';
import { trueColor, resetColor, hexToRgb } from '../../utils/theme.js';
import { clamp } from '../../utils/math.js';

export interface NeuralCanvasOptions {
  width: number;
  height: number;
  parent: Widgets.Screen;
}

export class NeuralCanvas {
  private screen: Widgets.Screen;
  private box: Widgets.BoxElement;
  private canvas: string[][];
  private width: number;
  private height: number;
  private network: NeuralNetwork | null = null;
  private animationId: NodeJS.Timeout | null = null;
  private lastFrameTime: number = 0;
  private fps: number = 60;
  private frameCount: number = 0;

  constructor(options: NeuralCanvasOptions) {
    this.screen = options.parent;
    this.width = options.width;
    this.height = options.height;

    this.box = blessed.box({
      parent: this.screen,
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
      style: {
        bg: 'black',
        fg: 'white',
      },
    });

    this.canvas = this.createEmptyCanvas();
  }

  private createEmptyCanvas(): string[][] {
    return Array(this.height).fill(null).map(() => Array(this.width).fill(' '));
  }

  setNetwork(network: NeuralNetwork): void {
    this.network = network;
  }

  startAnimation(): void {
    this.lastFrameTime = performance.now();
    this.animate();
  }

  stopAnimation(): void {
    if (this.animationId) {
      clearInterval(this.animationId);
      this.animationId = null;
    }
  }

  private animate(): void {
    this.animationId = setInterval(() => {
      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;
      this.lastFrameTime = now;

      if (this.network) {
        this.renderFrame(deltaTime);
        this.box.setContent(this.canvasToString());
        this.screen.render();
      }
    }, 1000 / this.fps);
  }

  renderFrame(deltaTime: number): void {
    if (!this.network) return;

    this.clearCanvas();
    this.renderSynapses();
    this.renderNeurons();
    this.renderParticles();
    this.renderUI();
    // The app drives renderFrame directly; without setContent the canvas stays blank.
    this.box.setContent(this.canvasToString());
  }

  private clearCanvas(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.canvas[y][x] = ' ';
      }
    }
  }

  private renderSynapses(): void {
    if (!this.network) return;

    for (const synapse of this.network.synapses.values()) {
      if (!synapse.isActive) continue;

      const source = this.network.neurons.get(synapse.sourceId);
      const target = this.network.neurons.get(synapse.targetId);
      if (!source || !target) continue;

      const x1 = Math.round(source.position.x);
      const y1 = Math.round(source.position.y);
      const x2 = Math.round(target.position.x);
      const y2 = Math.round(target.position.y);

      if (this.isInBounds(x1, y1) || this.isInBounds(x2, y2)) {
        this.drawLine(x1, y1, x2, y2, synapse);
      }
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number, synapse: Synapse): void {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    const isFiring = synapse.isFiring;
    const progress = synapse.fireProgress;
    const color = isFiring
      ? this.interpolateColor(synapse.color, THEME.colors.neonRed, progress)
      : synapse.color;

    let x = x1;
    let y = y1;
    let step = 0;
    const totalSteps = Math.max(dx, dy);

    while (true) {
      if (this.isInBounds(x, y)) {
        const char = this.getSynapseChar(x, y, x1, y1, x2, y2, step, totalSteps, isFiring, progress);
        this.setPixel(x, y, char, color);
      }

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
      step++;
    }
  }

  private getSynapseChar(
    x: number, y: number,
    x1: number, y1: number,
    x2: number, y2: number,
    step: number, totalSteps: number,
    isFiring: boolean,
    progress: number
  ): string {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    const isDiagonal = Math.abs(Math.abs(dx) - Math.abs(dy)) < 2;

    if (isFiring) {
      const fireChars = ['⚡', '✦', '✧', '★', '☆'];
      const fireIdx = Math.floor(progress * fireChars.length);
      if (Math.random() < 0.1) return fireChars[Math.min(fireIdx, fireChars.length - 1)];
    }

    if (isHorizontal) return '═';
    if (Math.abs(dx) === Math.abs(dy)) return dx * dy > 0 ? '╲' : '╱';
    return '║';
  }

  private renderNeurons(): void {
    if (!this.network) return;

    for (const neuron of this.network.neurons.values()) {
      const x = Math.round(neuron.position.x);
      const y = Math.round(neuron.position.y);

      if (!this.isInBounds(x, y)) continue;

      const char = this.getNeuronChar(neuron);
      const color = this.getNeuronColor(neuron);

      this.setPixel(x, y, char, color);

      if (neuron.isSelected || neuron.isHighlighted) {
        this.drawNeuronGlow(x, y, neuron);
      }

      if (neuron.isSelected) {
        this.drawLabel(x, y, neuron.label);
      }
    }
  }

  private getNeuronChar(neuron: Neuron): string {
    const pulse = Math.sin(neuron.pulsePhase);
    const activation = neuron.activation;

    if (activation > 0.8) return '⬤';
    if (activation > 0.5) return '◎';
    if (activation > 0.2) return '◉';

    if (pulse > 0.5) return '●';
    return '·';
  }

  private getNeuronColor(neuron: Neuron): string {
    if (neuron.isSelected) return THEME.colors.neonRed;
    if (neuron.isHighlighted) return THEME.colors.goldZion;
    if (neuron.activation > 0.5) return THEME.colors.neonRed;
    return neuron.color;
  }

  private drawNeuronGlow(x: number, y: number, neuron: Neuron): void {
    const radius = Math.max(1, Math.round(neuron.radius));
    const glowColor = neuron.isSelected ? THEME.colors.neonRed : THEME.colors.goldZion;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (this.isInBounds(px, py) && (dx !== 0 || dy !== 0)) {
          const dist = Math.hypot(dx, dy);
          if (dist <= radius && this.canvas[py][px] === ' ') {
            this.setPixel(px, py, radius === 1 ? '░' : '▒', glowColor);
          }
        }
      }
    }
  }

  private drawLabel(x: number, y: number, label: string): void {
    const labelY = y - 1;
    const startX = x - Math.floor(label.length / 2);

    for (let i = 0; i < label.length; i++) {
      const px = startX + i;
      if (this.isInBounds(px, labelY)) {
        this.setPixel(px, labelY, label[i], THEME.colors.textMuted);
      }
    }
  }

  private renderParticles(): void {
    if (!this.network) return;

    for (const synapse of this.network.synapses.values()) {
      for (const particle of synapse.particles) {
        const source = this.network.neurons.get(synapse.sourceId);
        const target = this.network.neurons.get(synapse.targetId);
        if (!source || !target) continue;

        const x = Math.round(source.position.x + synapse.direction.x * particle.position * synapse.length);
        const y = Math.round(source.position.y + synapse.direction.y * particle.position * synapse.length);

        if (this.isInBounds(x, y)) {
          const alpha = particle.life / particle.maxLife;
          const char = particle.size > 1 ? '●' : '·';
          this.setPixel(x, y, char, particle.color);
        }
      }
    }
  }

  private renderUI(): void {
    if (!this.network) return;

    const info = [
      `Neurons: ${this.network.neurons.size}`,
      `Synapses: ${this.network.synapses.size}`,
      `Firing: ${this.network.firingSynapses.size}`,
      `Time: ${(this.network.time / 1000).toFixed(1)}s`,
    ];

    for (let i = 0; i < info.length; i++) {
      this.drawText(1, 1 + i, info[i], THEME.colors.textGhost);
    }

    if (this.network.selectedNeuronId) {
      const neuron = this.network.neurons.get(this.network.selectedNeuronId);
      if (neuron) {
        const commit = neuron.commit;
        const lines = [
          `SELECTED: ${neuron.label}`,
          `Type: ${neuron.type}`,
          `Author: ${commit.authorName}`,
          `Date: ${commit.authorDate.toLocaleDateString()}`,
          `Msg: ${commit.message.substring(0, this.width - 6)}`,
        ];
        for (let i = 0; i < lines.length; i++) {
          this.drawText(1, this.height - lines.length + i, lines[i], THEME.colors.neonRed);
        }
      }
    }
  }

  private drawText(x: number, y: number, text: string, color: string): void {
    for (let i = 0; i < text.length; i++) {
      const px = x + i;
      if (this.isInBounds(px, y)) {
        this.setPixel(px, y, text[i], color);
      }
    }
  }

  private setPixel(x: number, y: number, char: string, color: string): void {
    if (!this.isInBounds(x, y)) return;
    this.canvas[y][x] = trueColor(color) + char + resetColor();
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  private interpolateColor(colorA: string, colorB: string, t: number): string {
    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);
    if (!rgbA || !rgbB) return colorA;
    const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * t);
    const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * t);
    const b = Math.round(rgbA.b + (rgbB.b - rgbA.b) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private canvasToString(): string {
    return this.canvas.map(row => row.join('')).join('\n');
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas = this.createEmptyCanvas();
    this.box.width = width;
    this.box.height = height;
  }

  destroy(): void {
    this.stopAnimation();
    this.box.destroy();
  }
}

export function createNeuralCanvas(options: NeuralCanvasOptions): NeuralCanvas {
  return new NeuralCanvas(options);
}