import blessed, { Widgets } from 'blessed';
import { GitParser } from './git/parser.js';
import { createBuilder, NeuralGraphBuilder, NeuralNetwork } from './neural/index.js';
import { NeuralCanvas, createNeuralCanvas } from './ui/components/NeuralCanvas.js';
import { renderCommitPanel } from './ui/panels/CommitPanel.js';
import { renderBranchPanel } from './ui/panels/BranchPanel.js';
import { renderFileTreePanel } from './ui/panels/FileTreePanel.js';
import { renderSearchPanel, searchCommits, SearchResult } from './ui/panels/SearchPanel.js';
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
    return resolve(repoArg.split('=')[1]);
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

      const canvasWidth = Math.floor(size.width * (1 - PANEL_WIDTH_RATIO));
      this.canvas = createNeuralCanvas({
        width: canvasWidth,
        height: size.height,
        parent: this.screen,
      });
      this.canvas.setNetwork(this.state.network);

      this.panelBox.width = Math.max(MIN_PANEL_WIDTH, Math.floor(size.width * PANEL_WIDTH_RATIO));
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
    this.screen.key(['q', 'C-c', 'escape'], () => {
      this.quit();
    });

    this.screen.key(['tab'], () => {
      this.cyclePanel();
    });

    this.screen.key(['f', '/'], () => {
      this.startSearch();
    });

    this.screen.key(['enter'], () => {
      this.handleEnter();
    });

    this.screen.key(['b'], () => {
      this.setPanel('branches');
    });

    this.screen.key(['c'], () => {
      this.setPanel('commit');
    });

    this.screen.key(['t'], () => {
      this.setPanel('files');
    });

    this.screen.key(['r'], () => {
      this.resetView();
    });

    this.screen.key(['space'], () => {
      this.toggleAnimation();
    });

    this.screen.key(['?'], () => {
      this.showHelp();
    });

    this.screen.key(['h', 'left'], () => {
      this.navigateCanvas('left');
    });

    this.screen.key(['l', 'right'], () => {
      this.navigateCanvas('right');
    });

    this.screen.key(['j', 'down'], () => {
      this.navigateCanvas('down');
    });

    this.screen.key(['k', 'up'], () => {
      this.navigateCanvas('up');
    });
  }

  private setupResize(): void {
    process.stdout.on('resize', () => {
      this.handleResize();
    });
  }

  private handleResize(): void {
    const size = getTerminalSize();
    const canvasWidth = Math.floor(size.width * (1 - PANEL_WIDTH_RATIO));
    const panelWidth = Math.max(MIN_PANEL_WIDTH, Math.floor(size.width * PANEL_WIDTH_RATIO));

    this.state.terminalWidth = size.width;
    this.state.terminalHeight = size.height;

    if (this.canvas) {
      this.canvas.resize(canvasWidth, size.height);
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
    this.loadDiff(neuronId);
    this.renderPanel();
    this.screen.render();
  }

  private async loadDiff(neuronId: string): Promise<void> {
    if (!this.state.network) return;
    const neuron = this.state.network.neurons.get(neuronId);
    if (!neuron) return;

    try {
      this.state.diff = await this.parser.getDiff(neuron.commit.hash, neuron.commit.parents[0]);
      this.renderPanel();
    } catch (error) {
      console.error('Failed to load diff:', error);
    }
  }

  private navigateCanvas(direction: 'up' | 'down' | 'left' | 'right'): void {
    // Navigation logic would be implemented here
    // For now, just re-render
    this.screen.render();
  }

  private resetView(): void {
    if (this.state.network) {
      this.builder.selectNeuron(this.state.network, null);
    }
    this.state.diff = null;
    this.renderPanel();
    this.screen.render();
  }

  private toggleAnimation(): void {
    if (this.animationInterval) {
      this.stopAnimation();
    } else {
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

    overlay.focus();
    overlay.key(['escape', 'q', 'enter'], () => {
      overlay.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  private renderPanel(): void {
    if (!this.panelBox) return;

    const panelWidth = Math.max(MIN_PANEL_WIDTH, Math.floor(this.state.terminalWidth * PANEL_WIDTH_RATIO));
    const panelHeight = this.state.terminalHeight;

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
        content = lines.join('\n');
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