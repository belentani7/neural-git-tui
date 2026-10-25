import blessed, { Widgets } from 'blessed';
import { GitParser } from './git/parser.js';
import { createBuilder, NeuralGraphBuilder, NeuralNetwork } from './neural/index.js';
import { NeuralCanvas, createNeuralCanvas } from './ui/components/NeuralCanvas.js';
import { renderCommitPanel } from './ui/panels/CommitPanel.js';
import { renderBranchPanel } from './ui/panels/BranchPanel.js';
import { renderFileTreePanel } from './ui/panels/FileTreePanel.js';
import { renderSearchPanel, searchCommits, SearchResult } from './ui/panels/SearchPanel.js';
import { editSearchQuery, nextNeuronId } from './ui/interaction.mjs';
import { THEME } from './utils/theme.js';
import { detectCapabilities, getTerminalSize, enableAlternateScreen, disableAlternateScreen, rawMode, hideCursor, showCursor } from './utils/terminal.js';
import { GitDiff, ParsedGitData } from './git/types.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type PanelType = 'commit' | 'branches' | 'files' | 'search';

interface AppState {
  parsedData: ParsedGitData | null;
  network: NeuralNetwork | null;
  diff: GitDiff | null;
  diffError: string | null;
  selectedPanel: PanelType;
  searchQuery: string;
  searchResults: SearchResult[];
  searchSelectedIndex: number;
  isSearching: boolean;
  isLoading: boolean;
  error: string | null;
  terminalWidth: number;
  terminalHeight: number;
}

const PANEL_WIDTH_RATIO = 0.35;
const MIN_PANEL_WIDTH = 40;

function getRepoPath(): string {
  const args = process.argv.slice(2);
  const repoArg = args.find(a => a.startsWith('--repo='));
  if (repoArg) {
    return resolve(repoArg.slice('--repo='.length) || '.');
  }
  return process.cwd();
}

class NeuralGitTUI {
  private screen: Widgets.Screen;
  private canvas: NeuralCanvas | null = null;
  private panelBox: Widgets.BoxElement;
  private parser: GitParser;
  private builder: NeuralGraphBuilder;
  private state: AppState;
  private animationInterval: NodeJS.Timeout | null = null;
  private lastFrameTime: number = 0;
  private repoPath: string;
  private activeOverlay: Widgets.BoxElement | null = null;
  private diffRequestId = 0;
  private animationEnabled = process.env.REDUCE_MOTION !== '1';

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Neural Git TUI',
      fullUnicode: true,
      autoPadding: false,
      warnings: false,
    });

    this.parser = new GitParser(repoPath);
    this.builder = createBuilder();

    this.state = {
      parsedData: null,
      network: null,
      diff: null,
      diffError: null,
      selectedPanel: 'commit',
      searchQuery: '',
      searchResults: [],
      searchSelectedIndex: 0,
      isSearching: false,
      isLoading: true,
      error: null,
      terminalWidth: 80,
      terminalHeight: 24,
    };

    this.panelBox = blessed.box({
      parent: this.screen,
      right: 0,
      top: 0,
      width: MIN_PANEL_WIDTH,
      height: '100%',
      style: {
        bg: 'black',
        fg: 'white',
      },
      border: {
        type: 'line',
        fg: 8,
      },
    });

    this.setupKeybindings();
    this.setupResize();
  }

  async initialize(): Promise<void> {
    try {
      enableAlternateScreen();
      rawMode(true);
      hideCursor();

      const size = getTerminalSize();
      this.state.terminalWidth = size.width;
      this.state.terminalHeight = size.height;

      this.state.parsedData = await this.parser.parseAll({ maxCount: 2000 });
      this.state.network = this.builder.build(this.state.parsedData);

      const panelWidth = Math.max(1, Math.min(size.width - 1, Math.max(28, Math.floor(size.width * PANEL_WIDTH_RATIO))));
      const canvasWidth = Math.max(1, size.width - panelWidth);
      this.canvas = createNeuralCanvas({
        width: canvasWidth,
        height: size.height,
        parent: this.screen,
      });
      this.canvas.setNetwork(this.state.network);

      this.panelBox.width = panelWidth;
      this.panelBox.left = canvasWidth;

      this.state.isLoading = false;
      this.renderPanel();

      this.startAnimation();
      this.screen.render();
    } catch (error) {
      this.state.error = String(error);
      this.state.isLoading = false;
      this.renderError();
    }
  }

  private startAnimation(): void {
    this.lastFrameTime = performance.now();
    if (!this.animationEnabled) {
      this.canvas?.renderFrame(0);
      this.screen.render();
      return;
    }
    this.animationInterval = setInterval(() => {
      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;
      this.lastFrameTime = now;

      if (this.state.network && this.canvas) {
        this.builder.update(this.state.network, deltaTime);
        this.canvas.renderFrame(deltaTime);
        this.screen.render();
      }
    }, 1000 / 60);
  }

  private stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  private setupKeybindings(): void {
    // A single dispatcher prevents global shortcuts from swallowing search input.
    this.screen.on('keypress', (ch: string | undefined, key: { name?: string; ctrl?: boolean; meta?: boolean } = {}) => {
      const name = key.name || '';
      if (key.ctrl && name === 'c') { this.quit(); return; }
      if (this.activeOverlay) return;

      if (this.state.isSearching) {
        if (name === 'escape') {
          this.state.searchQuery = '';
          this.state.searchResults = [];
          this.state.searchSelectedIndex = 0;
          this.setPanel('commit');
          return;
        }
        if (name === 'enter' || name === 'return') { this.handleEnter(); return; }
        if (name === 'up' || name === 'down') {
          const step = name === 'up' ? -1 : 1;
          this.state.searchSelectedIndex = Math.max(0, Math.min(this.state.searchResults.length - 1, this.state.searchSelectedIndex + step));
          this.renderPanel();
          this.screen.render();
          return;
        }
        if (key.ctrl || key.meta) return;
        const query = editSearchQuery(this.state.searchQuery, name, ch);
        if (query !== this.state.searchQuery) {
          this.state.searchQuery = query;
          this.state.searchResults = this.state.network ? searchCommits(this.state.network, query) : [];
          this.state.searchSelectedIndex = 0;
          this.renderPanel();
          this.screen.render();
        }
        return;
      }

      if (key.ctrl || key.meta) return;
      if (name === 'q' || name === 'escape') { this.quit(); return; }
      if (name === 'tab') { this.cyclePanel(); return; }
      if (name === 'f' || name === '/' || ch === '/') { this.startSearch(); return; }
      if (name === 'enter' || name === 'return') { this.handleEnter(); return; }
      if (name === 'b') { this.setPanel('branches'); return; }
      if (name === 'c') { this.setPanel('commit'); return; }
      if (name === 't') { this.setPanel('files'); return; }
      if (name === 'r') { this.resetView(); return; }
      if (name === 'space') { this.toggleAnimation(); return; }
      if (ch === '?' || name === '?') { this.showHelp(); return; }
      const directions: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        h: 'left', left: 'left', l: 'right', right: 'right',
        j: 'down', down: 'down', k: 'up', up: 'up',
      };
      if (directions[name]) this.navigateCanvas(directions[name]);
    });
  }

  private setupResize(): void {
    process.stdout.on('resize', () => {
      this.handleResize();
    });
  }

  private handleResize(): void {
    const size = getTerminalSize();
    const panelWidth = Math.max(1, Math.min(size.width - 1, Math.max(28, Math.floor(size.width * PANEL_WIDTH_RATIO))));
    const canvasWidth = Math.max(1, size.width - panelWidth);

    this.state.terminalWidth = size.width;
    this.state.terminalHeight = size.height;

    if (this.canvas) {
      this.canvas.resize(canvasWidth, size.height);
      this.canvas.renderFrame(0);
    }

    this.panelBox.width = panelWidth;
    this.panelBox.left = canvasWidth;

    if (this.state.network) {
      this.builder.rescale(this.state.network, canvasWidth, size.height);
    }

    this.renderPanel();
    this.screen.render();
  }

  private cyclePanel(): void {
    const panels: PanelType[] = ['commit', 'branches', 'files', 'search'];
    const currentIndex = panels.indexOf(this.state.selectedPanel);
    const nextIndex = (currentIndex + 1) % panels.length;
    this.setPanel(panels[nextIndex]);
  }

  private setPanel(panel: PanelType): void {
    this.state.selectedPanel = panel;
    if (panel === 'search') {
      this.state.isSearching = true;
    } else {
      this.state.isSearching = false;
    }
    this.renderPanel();
    this.screen.render();
  }

  private startSearch(): void {
    this.setPanel('search');
  }

  private handleEnter(): void {
    if (this.state.isSearching) {
      this.selectSearchResult();
    } else if (this.state.network && this.state.network.hoveredNeuronId) {
      this.selectNeuron(this.state.network.hoveredNeuronId);
    }
  }

  private selectSearchResult(): void {
    const result = this.state.searchResults[this.state.searchSelectedIndex];
    if (result && this.state.network) {
      this.state.isSearching = false;
      this.state.searchQuery = '';
      this.state.searchResults = [];
      this.state.searchSelectedIndex = 0;
      this.state.selectedPanel = 'commit';
      this.selectNeuron(result.neuron.id);
    }
  }

  private selectNeuron(neuronId: string): void {
    if (!this.state.network) return;

    this.builder.selectNeuron(this.state.network, neuronId);
    this.state.diff = null;
    this.state.diffError = null;
    void this.loadDiff(neuronId);
    this.renderPanel();
    this.screen.render();
  }

  private async loadDiff(neuronId: string): Promise<void> {
    const requestId = ++this.diffRequestId;
    const neuron = this.state.network?.neurons.get(neuronId);
    if (!neuron) return;
    try {
      const diff = await this.parser.getDiff(neuron.commit.hash, neuron.commit.parents[0]);
      if (requestId !== this.diffRequestId) return; // Ignore stale async results.
      this.state.diff = diff;
      this.state.diffError = null;
    } catch {
      if (requestId !== this.diffRequestId) return;
      this.state.diff = null;
      this.state.diffError = 'Could not load the selected commit diff.';
    }
    this.renderPanel();
    this.screen.render();
  }

  private navigateCanvas(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (!this.state.network) return;
    const network = this.state.network;
    const nextId = nextNeuronId(network.neurons, network.hoveredNeuronId || network.selectedNeuronId, direction);
    if (!nextId) return;
    this.builder.hoverNeuron(network, nextId);
    this.canvas?.renderFrame(0);
    this.screen.render();
  }

  private resetView(): void {
    if (this.state.network) {
      this.builder.selectNeuron(this.state.network, null);
    }
    ++this.diffRequestId;
    this.state.diff = null;
    this.state.diffError = null;
    this.renderPanel();
    this.screen.render();
  }

  private toggleAnimation(): void {
    if (this.animationInterval) {
      this.stopAnimation();
      this.animationEnabled = false;
    } else {
      this.animationEnabled = true;
      this.startAnimation();
    }
  }

  private showHelp(): void {
    const helpText = `
NEURAL GIT TUI - Help

Navigation:
  hjkl / arrows  - Navigate canvas
  Tab            - Cycle panels (commit/branches/files/search)
  f / /          - Search commits
  Enter          - Select neuron / search result
  b              - Branches panel
  c              - Commit panel
  t              - Files panel
  r              - Reset view
  Space          - Pause/resume animation
  q / Esc        - Quit
  ?              - Show this help

Search mode:
  Type to search  - Filter commits by hash, message, author, date
  ↑/↓            - Navigate results
  Enter          - Select result
  Backspace      - Delete character
  Esc            - Exit search

Panels:
  Commit     - Selected commit details
  Branches   - All branches with sync status
  Files      - File changes in selected commit
  Search     - Find commits
`;

    this.showOverlay(helpText);
  }

  private showOverlay(content: string): void {
    const overlay = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      border: { type: 'line', fg: 9 },
      style: { bg: 'black', fg: 'white' },
      content,
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
    });

    this.activeOverlay = overlay;
    overlay.focus();
    overlay.key(['escape', 'q', 'enter'], () => {
      this.activeOverlay = null;
      overlay.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  private renderPanel(): void {
    if (!this.panelBox) return;

    const panelWidth = Math.max(1, Math.min(this.state.terminalWidth - 1, Math.max(28, Math.floor(this.state.terminalWidth * PANEL_WIDTH_RATIO))));
    const panelHeight = this.state.terminalHeight;
    if (panelWidth < 24 || panelHeight < 12) {
      this.panelBox.setContent('Terminal too small. Resize to at least 34 columns and 12 rows.');
      return;
    }

    let content: string;

    switch (this.state.selectedPanel) {
      case 'commit': {
        const neuron = this.state.network?.selectedNeuronId
          ? this.state.network?.neurons.get(this.state.network.selectedNeuronId) || null
          : null;
        const lines = renderCommitPanel({
          width: panelWidth,
          height: panelHeight,
          neuron,
          network: this.state.network,
        });
        content = lines.join('\n');
        break;
      }
      case 'branches': {
        const lines = renderBranchPanel({
          width: panelWidth,
          height: panelHeight,
          branches: this.state.parsedData?.branches || [],
          currentBranch: this.state.parsedData?.repoInfo.currentBranch || '',
          network: this.state.network,
        });
        content = lines.join('\n');
        break;
      }
      case 'files': {
        const lines = renderFileTreePanel({
          width: panelWidth,
          height: panelHeight,
          diff: this.state.diff,
        });
        content = this.state.diffError ? `FILE CHANGES\n\n${this.state.diffError}` : lines.join('\n');
        break;
      }
      case 'search': {
        const lines = renderSearchPanel({
          width: panelWidth,
          height: panelHeight,
          query: this.state.searchQuery,
          results: this.state.searchResults,
          selectedIndex: this.state.searchSelectedIndex,
          network: this.state.network,
        });
        content = lines.join('\n');
        break;
      }
    }

    this.panelBox.setContent(content);
  }

  private renderError(): void {
    if (this.state.error) {
      const errorBox = blessed.box({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: '60%',
        height: '30%',
border: { type: 'line', fg: 9 },
        style: { bg: 'black', fg: 'white' },
        content: `Error: ${this.state.error}\n\nPress q to quit`,
        tags: true,
      });
      errorBox.focus();
      this.screen.render();
    }
  }

  private quit(): void {
    this.stopAnimation();
    if (this.canvas) {
      this.canvas.destroy();
    }
    disableAlternateScreen();
    rawMode(false);
    showCursor();
    process.exit(0);
  }

  run(): void {
    this.initialize().then(() => {
      // App running
    }).catch((error) => {
      console.error('Failed to initialize:', error);
      this.quit();
    });
  }
}

const repoPath = getRepoPath();
const app = new NeuralGitTUI(repoPath);
app.run();