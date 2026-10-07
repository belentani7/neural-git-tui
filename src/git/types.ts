export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorDate: Date;
  committerName: string;
  committerEmail: string;
  committerDate: Date;
  parents: string[];
  refs: string[];
  body: string;
}

export interface GitBranch {
  name: string;
  hash: string;
  isRemote: boolean;
  isHead: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked';
  additions: number;
  deletions: number;
  oldPath?: string;
  binary: boolean;
}

export interface GitDiff {
  commitHash: string;
  parentHash: string;
  files: GitFileChange[];
  stats: {
    totalAdditions: number;
    totalDeletions: number;
    totalFiles: number;
  };
}

export interface GitRepoInfo {
  root: string;
  currentBranch: string;
  headHash: string;
  isBare: boolean;
  remotes: string[];
}

export interface ParsedGitData {
  commits: GitCommit[];
  branches: GitBranch[];
  repoInfo: GitRepoInfo;
  commitGraph: Map<string, string[]>;
}

export interface GitLogOptions {
  maxCount?: number;
  since?: Date;
  until?: Date;
  author?: string;
  branch?: string;
  all?: boolean;
  graph?: boolean;
}