export interface GitLogEntry {
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
export declare function parseGitLog(output: string): GitLogEntry[];
