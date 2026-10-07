import { Vec2 } from '../utils/math.js';
import { GitCommit, GitBranch } from '../git/types.js';

export type NeuronType = 'commit' | 'merge' | 'root' | 'head' | 'tag';
export type SynapseType = 'parent' | 'child' | 'merge' | 'branch';

export interface Neuron {
  id: string;
  commit: GitCommit;
  type: NeuronType;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  charge: number;
  activation: number;
  radius: number;
  color: string;
  label: string;
  connections: string[];
  isSelected: boolean;
  isHighlighted: boolean;
  pulsePhase: number;
  lastFired: number;
}

export interface Synapse {
  id: string;
  sourceId: string;
  targetId: string;
  type: SynapseType;
  weight: number;
  length: number;
  direction: Vec2;
  signalPosition: number;
  isActive: boolean;
  isFiring: boolean;
  fireProgress: number;
  particles: SynapseParticle[];
  color: string;
  width: number;
}

export interface SynapseParticle {
  position: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  velocity: number;
}

export interface NeuralNetwork {
  neurons: Map<string, Neuron>;
  synapses: Map<string, Synapse>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  center: Vec2;
  scale: number;
  time: number;
  selectedNeuronId: string | null;
  hoveredNeuronId: string | null;
  firingSynapses: Set<string>;
  signalQueue: SignalEvent[];
}

export interface SignalEvent {
  id: string;
  sourceId: string;
  targetId: string;
  startTime: number;
  duration: number;
  type: 'selection' | 'navigation' | 'merge' | 'branch';
  intensity: number;
}

export interface LayoutConfig {
  repulsion: number;
  attraction: number;
  damping: number;
  minDistance: number;
  maxDistance: number;
  iterations: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  repulsion: 50,
  attraction: 0.1,
  damping: 0.9,
  minDistance: 3,
  maxDistance: 15,
  iterations: 100,
};

export function createNeuron(commit: GitCommit, index: number, total: number): Neuron {
  const angle = (index / total) * Math.PI * 2;
  const radius = Math.min(30, Math.max(10, total * 0.5));
  const isMerge = commit.parents.length > 1;
  const isRoot = commit.parents.length === 0;
  const isHead = index === 0;

  let type: NeuronType = 'commit';
  if (isHead) type = 'head';
  else if (isMerge) type = 'merge';
  else if (isRoot) type = 'root';
  else if (commit.refs.some(r => r.startsWith('tag: '))) type = 'tag';

  return {
    id: commit.hash,
    commit,
    type,
    position: {
      x: Math.cos(angle) * radius + (Math.random() - 0.5) * 5,
      y: Math.sin(angle) * radius * 0.6 + (Math.random() - 0.5) * 3,
    },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    charge: isMerge ? 2 : isRoot ? 1.5 : isHead ? 2.5 : 1,
    activation: 0,
    radius: isMerge ? 2.5 : isRoot ? 2 : isHead ? 3 : 1.5,
    color: '',
    label: commit.shortHash,
    connections: [...commit.parents],
    isSelected: false,
    isHighlighted: false,
    pulsePhase: Math.random() * Math.PI * 2,
    lastFired: 0,
  };
}

export function createSynapse(
  sourceId: string,
  targetId: string,
  type: SynapseType,
  weight: number = 1
): Synapse {
  return {
    id: `${sourceId}-${targetId}`,
    sourceId,
    targetId,
    type,
    weight,
    length: 0,
    direction: { x: 0, y: 0 },
    signalPosition: 0,
    isActive: true,
    isFiring: false,
    fireProgress: 0,
    particles: [],
    color: '',
    width: type === 'merge' ? 2 : 1,
  };
}

export function getNeuronColor(type: NeuronType, theme: any): string {
  switch (type) {
    case 'head': return theme.colors.neonRed;
    case 'merge': return theme.colors.goldZion;
    case 'root': return theme.colors.cyan;
    case 'tag': return theme.colors.mergeGlow;
    default: return theme.colors.neuronResting;
  }
}

export function getSynapseColor(type: SynapseType, theme: any): string {
  switch (type) {
    case 'merge': return theme.colors.mergeGlow;
    case 'branch': return theme.colors.branchHighlight;
    case 'parent':
    case 'child':
    default: return theme.colors.synapseResting;
  }
}

export function getNeuronChar(type: NeuronType, activation: number, pulsePhase: number): string {
  const chars = {
    tiny: '·',
    small: '●',
    medium: '◉',
    large: '◎',
    huge: '⬤',
  };

  const pulseIndex = Math.floor((Math.sin(pulsePhase) + 1) / 2 * 4);
  const pulseChars = ['·', '●', '◉', '◎', '⬤'];
  const baseChar = pulseChars[Math.min(pulseIndex, pulseChars.length - 1)];

  if (activation > 0.8) return chars.huge;
  if (activation > 0.5) return chars.large;
  if (activation > 0.2) return chars.medium;
  return baseChar;
}