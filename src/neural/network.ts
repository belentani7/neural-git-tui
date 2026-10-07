import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force';
import {
  NeuralNetwork,
  Neuron,
  Synapse,
  SignalEvent,
  DEFAULT_LAYOUT_CONFIG,
  LayoutConfig,
  createNeuron,
  createSynapse,
  getNeuronColor,
  getSynapseColor,
} from './types.js';
import { GitCommit, GitBranch, ParsedGitData } from '../git/types.js';
import { Vec2, clamp } from '../utils/math.js';
import { THEME } from '../utils/theme.js';

export class NeuralGraphBuilder {
  private config: LayoutConfig;
  private theme: typeof THEME;

  constructor(config?: Partial<LayoutConfig>, theme: typeof THEME = THEME) {
    this.config = { ...DEFAULT_LAYOUT_CONFIG, ...config };
    this.theme = theme;
  }

  build(parsedData: ParsedGitData): NeuralNetwork {
    const neurons = new Map<string, Neuron>();
    const synapses = new Map<string, Synapse>();

    const commits = parsedData.commits;
    const total = commits.length;

    for (let i = 0; i < total; i++) {
      const commit = commits[i];
      const neuron = createNeuron(commit, i, total);
      neuron.color = getNeuronColor(neuron.type, this.theme);
      neurons.set(commit.hash, neuron);
    }

    for (const commit of commits) {
      const neuron = neurons.get(commit.hash);
      if (!neuron) continue;

      for (const parentHash of commit.parents) {
        if (!neurons.has(parentHash)) continue;
        const synapse = createSynapse(commit.hash, parentHash, 'parent');
        synapse.color = getSynapseColor('parent', this.theme);
        synapses.set(synapse.id, synapse);
      }

      if (commit.parents.length > 1) {
        for (let i = 1; i < commit.parents.length; i++) {
          const synapse = createSynapse(commit.parents[0], commit.parents[i], 'merge');
          synapse.color = getSynapseColor('merge', this.theme);
          synapses.set(synapse.id, synapse);
        }
      }
    }

    const branches = parsedData.branches;
    for (const branch of branches) {
      if (branch.isHead && neurons.has(branch.hash)) {
        const neuron = neurons.get(branch.hash)!;
        neuron.type = 'head';
        neuron.color = getNeuronColor('head', this.theme);
        neuron.radius = 3;
      }
    }

    const network: NeuralNetwork = {
      neurons,
      synapses,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      center: { x: 0, y: 0 },
      scale: 1,
      time: 0,
      selectedNeuronId: null,
      hoveredNeuronId: null,
      firingSynapses: new Set(),
      signalQueue: [],
    };

    this.applyLayout(network);
    this.fitToBounds(network);
    this.updateSynapseGeometry(network);

    return network;
  }

  private applyLayout(network: NeuralNetwork): void {
    const nodes = Array.from(network.neurons.values());
    const links = Array.from(network.synapses.values())
      .map(s => ({ source: s.sourceId, target: s.targetId }))
      .filter(l => network.neurons.has(l.source) && network.neurons.has(l.target));

    const simulation = forceSimulation(nodes as any)
      .force('charge', forceManyBody().strength(-this.config.repulsion))
      .force('link', forceLink(links as any).id((d: any) => d.id).distance(this.config.maxDistance).strength(this.config.attraction))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide().radius(d => (d as Neuron).radius + 2).strength(0.5))
      .alphaDecay(0.02)
      .velocityDecay(this.config.damping);

    for (let i = 0; i < this.config.iterations; i++) {
      simulation.tick();
    }

    simulation.stop();
  }

  private fitToBounds(network: NeuralNetwork): void {
    const nodes = Array.from(network.neurons.values());
    if (nodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxY = Math.max(maxY, n.position.y);
    }

    const padding = 5;
    network.bounds = {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    };
    network.center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
  }

  private updateSynapseGeometry(network: NeuralNetwork): void {
    for (const synapse of network.synapses.values()) {
      const source = network.neurons.get(synapse.sourceId);
      const target = network.neurons.get(synapse.targetId);
      if (!source || !target) continue;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      synapse.length = Math.hypot(dx, dy);
      synapse.direction = synapse.length > 0 ? { x: dx / synapse.length, y: dy / synapse.length } : { x: 0, y: 0 };
    }
  }

  update(network: NeuralNetwork, deltaTime: number): void {
    network.time += deltaTime;

    for (const neuron of network.neurons.values()) {
      neuron.pulsePhase += deltaTime * 0.001 * THEME.animation.neuronPulseSpeed;
      neuron.activation = clamp(neuron.activation * 0.98, 0, 1);

      if (neuron.isSelected) {
        neuron.activation = Math.max(neuron.activation, 0.8);
      }
    }

    this.updateSynapses(network, deltaTime);
    this.processSignalQueue(network, deltaTime);
  }

  private updateSynapses(network: NeuralNetwork, deltaTime: number): void {
    for (const synapse of network.synapses.values()) {
      const source = network.neurons.get(synapse.sourceId);
      const target = network.neurons.get(synapse.targetId);
      if (!source || !target) continue;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      synapse.length = Math.hypot(dx, dy);
      synapse.direction = synapse.length > 0 ? { x: dx / synapse.length, y: dy / synapse.length } : { x: 0, y: 0 };

      if (synapse.isFiring) {
        synapse.fireProgress += deltaTime / THEME.animation.firingDuration;
        if (synapse.fireProgress >= 1) {
          synapse.isFiring = false;
          synapse.fireProgress = 0;
          network.firingSynapses.delete(synapse.id);
        }
      }

      this.updateSynapseParticles(synapse, deltaTime);
    }
  }

  private updateSynapseParticles(synapse: Synapse, deltaTime: number): void {
    for (let i = synapse.particles.length - 1; i >= 0; i--) {
      const p = synapse.particles[i];
      p.life -= deltaTime;
      p.position += p.velocity * deltaTime / 1000;
      if (p.life <= 0 || p.position >= 1) {
        synapse.particles.splice(i, 1);
      }
    }

    if (synapse.isFiring && Math.random() < 0.3) {
      synapse.particles.push({
        position: 0,
        size: 0.5 + Math.random() * 1,
        color: synapse.color,
        life: THEME.animation.firingDuration,
        maxLife: THEME.animation.firingDuration,
        velocity: 0.5 + Math.random() * 1.5,
      });
    }
  }

  private processSignalQueue(network: NeuralNetwork, deltaTime: number): void {
    const now = network.time;
    for (let i = network.signalQueue.length - 1; i >= 0; i--) {
      const signal = network.signalQueue[i];
      const elapsed = now - signal.startTime;
      if (elapsed >= signal.duration) {
        network.signalQueue.splice(i, 1);
        this.completeSignal(network, signal);
      }
    }
  }

  private completeSignal(network: NeuralNetwork, signal: SignalEvent): void {
    const synapse = network.synapses.get(`${signal.sourceId}-${signal.targetId}`);
    if (synapse) {
      synapse.isFiring = true;
      synapse.fireProgress = 0;
      network.firingSynapses.add(synapse.id);

      const target = network.neurons.get(signal.targetId);
      if (target) {
        target.activation = Math.min(target.activation + signal.intensity, 1);
        target.lastFired = network.time;
      }
    }
  }

  fireSignal(network: NeuralNetwork, sourceId: string, targetId: string, type: SignalEvent['type'] = 'selection'): void {
    const signal: SignalEvent = {
      id: `signal-${Date.now()}-${Math.random()}`,
      sourceId,
      targetId,
      startTime: network.time,
      duration: THEME.animation.signalTravelSpeed,
      type,
      intensity: type === 'merge' ? 1 : 0.7,
    };
    network.signalQueue.push(signal);
  }

  selectNeuron(network: NeuralNetwork, neuronId: string | null): void {
    if (network.selectedNeuronId) {
      const prev = network.neurons.get(network.selectedNeuronId);
      if (prev) prev.isSelected = false;
    }

    network.selectedNeuronId = neuronId;

    if (neuronId) {
      const neuron = network.neurons.get(neuronId);
      if (neuron) {
        neuron.isSelected = true;
        neuron.activation = 1;

        for (const parentId of neuron.commit.parents) {
          this.fireSignal(network, neuronId, parentId, 'navigation');
        }

        for (const childId of neuron.connections) {
          this.fireSignal(network, neuronId, childId, 'navigation');
        }
      }
    }
  }

  hoverNeuron(network: NeuralNetwork, neuronId: string | null): void {
    if (network.hoveredNeuronId && network.hoveredNeuronId !== neuronId) {
      const prev = network.neurons.get(network.hoveredNeuronId);
      if (prev) prev.isHighlighted = false;
    }

    network.hoveredNeuronId = neuronId;

    if (neuronId) {
      const neuron = network.neurons.get(neuronId);
      if (neuron) neuron.isHighlighted = true;
    }
  }

  rescale(network: NeuralNetwork, width: number, height: number): void {
    const bounds = network.bounds;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;

    if (contentWidth === 0 || contentHeight === 0) return;

    const scaleX = (width - 10) / contentWidth;
    const scaleY = (height - 10) / contentHeight;
    network.scale = Math.min(scaleX, scaleY, 2);

    const offsetX = (width - contentWidth * network.scale) / 2 - bounds.minX * network.scale;
    const offsetY = (height - contentHeight * network.scale) / 2 - bounds.minY * network.scale;

    for (const neuron of network.neurons.values()) {
      neuron.position.x = neuron.position.x * network.scale + offsetX;
      neuron.position.y = neuron.position.y * network.scale + offsetY;
    }

    this.updateSynapseGeometry(network);
  }
}

export function createBuilder(config?: Partial<LayoutConfig>): NeuralGraphBuilder {
  return new NeuralGraphBuilder(config);
}