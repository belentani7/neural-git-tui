import { simpleGit, SimpleGit, BranchSummary } from 'simple-git';
import { parseGitLog } from './parse-log.mjs';
import {
  GitCommit,
  GitBranch,
  GitFileChange,
  GitDiff,
  GitRepoInfo,
  ParsedGitData,
  GitLogOptions,
} from './types.js';

const LOG_FORMAT = {
  hash: '%H',
  shortHash: '%h',
  message: '%s',
  authorName: '%an',
  authorEmail: '%ae',
  authorDate: '%aI',
  committerName: '%cn',
  committerEmail: '%ce',
  committerDate: '%cI',
  parents: '%P',
  refs: '%D',
  body: '%b',
};

const LOG_FORMAT_STRING = Object.entries(LOG_FORMAT)
  .map(([key, value]) => `${key}:${value}`)
  .join('%x00') + '%x00%x00';

export class GitParser {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async getRepoInfo(): Promise<GitRepoInfo> {
    const [root, branch, headHash, isBare, remotes] = await Promise.all([
      this.git.revparse(['--show-toplevel']),
      this.git.branch(),
      this.git.revparse(['HEAD']),
      this.git.checkIsRepo(),
      this.git.getRemotes(true),
    ]);

    return {
      root: root.trim(),
      currentBranch: branch.current,
      headHash: headHash.trim(),
      isBare: !isBare,
      remotes: remotes.map((r: any) => r.name),
    };
  }

  async getCommits(options: GitLogOptions = {}): Promise<GitCommit[]> {
    const args = ['log', `--format=${LOG_FORMAT_STRING}`];

    if (options.maxCount) args.push(`-n${options.maxCount}`);
    if (options.since) args.push(`--since=${options.since.toISOString()}`);
    if (options.until) args.push(`--until=${options.until.toISOString()}`);
    if (options.author) args.push(`--author=${options.author}`);
    if (options.branch) args.push(options.branch);
    if (options.all) args.push('--all');
    // Graph drawing is performed by the neural UI; ASCII --graph corrupts machine-readable fields.

    const output = await this.git.raw(args);
    return parseGitLog(output);
  }

  async getBranches(): Promise<GitBranch[]> {
    const summary: BranchSummary = await this.git.branch(['-a', '-v']);
    return Object.values(summary.branches)
      .filter((b: any) => !b.name.startsWith('HEAD'))
      .map((b: any) => ({
        name: b.name.replace(/^remotes\//, ''),
        hash: b.commit,
        isRemote: b.name.startsWith('remotes/'),
        isHead: b.current,
        upstream: b.upstream,
        ahead: 0,
        behind: 0,
      }));
  }

  async getDiff(commitHash: string, parentHash?: string): Promise<GitDiff> {
    // Root commits have no ^ parent; compare against Git's canonical empty tree.
    const parents = parentHash ? [parentHash] : (await this.git.raw(['rev-list', '--parents', '-n', '1', commitHash])).trim().split(/\s+/).slice(1);
    const parent = parents[0] || '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
    const diffSummary = await this.git.diffSummary([parent, commitHash]);
    const files: GitFileChange[] = diffSummary.files.map((f: any) => ({
      path: f.file,
      status: this.mapStatus(f.type),
      additions: f.insertions,
      deletions: f.deletions,
      binary: f.binary,
    }));

    return {
      commitHash,
      parentHash: parent,
      files,
      stats: {
        totalAdditions: diffSummary.insertions,
        totalDeletions: diffSummary.deletions,
        totalFiles: diffSummary.files.length,
      },
    };
  }

  private mapStatus(type: string): GitFileChange['status'] {
    switch (type) {
      case 'added': return 'added';
      case 'modified': return 'modified';
      case 'deleted': return 'deleted';
      case 'renamed': return 'renamed';
      case 'copied': return 'copied';
      default: return 'modified';
    }
  }

  async getFileTree(commitHash: string = 'HEAD'): Promise<string[]> {
    const output = await this.git.raw(['ls-tree', '-r', '--name-only', commitHash]);
    return output.trim().split('\n').filter(Boolean);
  }

  async parseAll(options: GitLogOptions = {}): Promise<ParsedGitData> {
    const [repoInfo, commits, branches] = await Promise.all([
      this.getRepoInfo(),
      this.getCommits({ ...options, maxCount: options.maxCount || 5000 }),
      this.getBranches(),
    ]);

    const commitGraph = new Map<string, string[]>();
    for (const commit of commits) {
      commitGraph.set(commit.hash, commit.parents);
    }

    return { commits, branches, repoInfo, commitGraph };
  }
}

export async function createParser(repoPath?: string): Promise<GitParser> {
  const parser = new GitParser(repoPath);
  await parser.getRepoInfo();
  return parser;
}