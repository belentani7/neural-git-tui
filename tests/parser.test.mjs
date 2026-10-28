import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { GitParser } from "../dist/git/parser.js";

test("GitParser preserves multiline commit messages without inventing commits", async (t) => {
  const repo = mkdtempSync(join(tmpdir(), "neural-git-log-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  function git(...args) {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  }
  git("init", "-q");
  git("config", "user.name", "Regression Test");
  git("config", "user.email", "test@example.invalid");
  git("commit", "-q", "--allow-empty", "-m", "First commit");
  git("commit", "-q", "--allow-empty", "-m", "Second commit", "-m", "First paragraph\n\nSecond paragraph");

  const parser = new GitParser(repo);
  const commits = await parser.getCommits({ maxCount: 10 });
  assert.equal(commits.length, 2, "should return two actual commits");
  assert.equal(commits[0].message, "Second commit");
  assert.equal(commits[0].body, "First paragraph\n\nSecond paragraph");
  assert.equal(commits[1].message, "First commit");
  assert.match(commits[0].hash, /^[a-f0-9]{40}$/);
  assert.notEqual(commits[0].hash, commits[1].hash);
});

test("GitParser.getFileTree returns exact Git paths, including Unicode and control characters", async (t) => {
  const repo = mkdtempSync(join(tmpdir(), "neural-git-tree-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const git = (...args) => execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
  git("init", "-q");
  git("-c", "user.name=Regression Test", "-c", "user.email=test@example.invalid",
      "commit", "-q", "--allow-empty", "-m", "Empty root");
  const emptyTreeCommit = git("rev-parse", "HEAD");

  const filenames = ["plain.txt", "line\\nbreak.txt", "tab\\tname.txt", "unicodé.txt", "--leading-dash.txt"]
    .map(name => name.replace(/\\n/g, "\n").replace(/\\t/g, "\t"));
  for (const filename of filenames) writeFileSync(join(repo, filename), "content");
  git("add", "--", ".");
  git("-c", "user.name=Regression Test", "-c", "user.email=test@example.invalid",
      "commit", "-q", "-m", "Paths requiring exact framing");

  const parser = new GitParser(repo);
  assert.deepEqual(await parser.getFileTree(emptyTreeCommit), []);
  assert.deepEqual((await parser.getFileTree()).sort(), filenames.slice().sort());
});
