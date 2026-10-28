import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parseGitLog } from "../src/git/parse-log.mjs";

const format = [
  "hash:%H", "shortHash:%h", "message:%s",
  "authorName:%an", "authorEmail:%ae", "authorDate:%aI",
  "committerName:%cn", "committerEmail:%ce", "committerDate:%cI",
  "parents:%P", "refs:%D", "body:%b",
].join("%x00") + "%x00%x00";

test("reads two genuine Git commits preserving multi-paragraph commit bodies", () => {
  const root = mkdtempSync(join(tmpdir(), "neural-git-fixture-"));
  const git = (...args) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args],
    { cwd: root, encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } }).trim();
  try {
    git("init", "-q");
    writeFileSync(join(root, "sample.txt"), "one");
    git("add", "sample.txt");
    git("-c", "user.name=Test Author", "-c", "user.email=example@example.test",
      "commit", "-q", "-m", "Initial");
    writeFileSync(join(root, "sample.txt"), "two");
    git("add", "sample.txt");
    git("-c", "user.name=Test Author", "-c", "user.email=example@example.test",
      "commit", "-q", "-m", "Second: with colon", "-m", "First paragraph\n\nSecond paragraph of body");
    const raw = git("log", "--format=" + format);
    const parsed = parseGitLog(raw);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].message, "Second: with colon");
    assert.match(parsed[0].body, /First paragraph\n\nSecond paragraph of body/);
    assert.equal(parsed[1].message, "Initial");
    assert.deepEqual(parsed[1].parents, []);
    assert.deepEqual(parsed[0].parents, [parsed[1].hash]);
    assert.ok(parsed[0].authorDate instanceof Date && !Number.isNaN(+parsed[0].authorDate));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("colon-containing metadata, URL and blank output are handled", () => {
  const row = [
    "hash:" + "a".repeat(40), "shortHash:aaaaaa", "message:URL: https://example.com:8080",
    "authorName:A: B", "authorEmail:a@example.test", "authorDate:2026-10-22T10:00:00Z",
    "committerName:A: B", "committerEmail:a@example.test", "committerDate:2026-10-22T10:00:00Z",
    "parents:", "refs:HEAD -> main, tag: v1", "body:Line 1\n\nLine 3",
  ].join("\x00") + "\x00\x00";
  const [commit] = parseGitLog(row);
  assert.equal(commit.message, "URL: https://example.com:8080");
  assert.equal(commit.authorName, "A: B");
  assert.equal(commit.body, "Line 1\n\nLine 3");
  assert.deepEqual(commit.refs, ["HEAD -> main", "tag: v1"]);
  assert.deepEqual(parseGitLog(""), []);
});

test("visual ASCII graph is not mixed into structured Git records", () => {
  const parser = readFileSync(new URL("../src/git/parser.ts", import.meta.url), "utf8");
  assert.match(parser, /parseGitLog\(output\)/);
  assert.match(parser, /\.join\('%x00'\) \+ '%x00%x00'/);
  assert.doesNotMatch(parser, /args\.push\('--graph'\)/);
});

test("real Git commits preserve ASCII field and record separators inside message bodies", () => {
  const root = mkdtempSync(join(tmpdir(), "neural-git-controls-"));
  const git = (...args) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args],
    { cwd: root, encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } }).trim();
  try {
    git("init", "-q");
    git("-c", "user.name=Test Author", "-c", "user.email=example@example.test",
      "commit", "-q", "--allow-empty", "-m", "First commit");
    const body = "First paragraph \x1f preserved\n\nSecond paragraph \x1e preserved";
    writeFileSync(join(root, "message.txt"), "Second commit\n\n" + body + "\n");
    git("-c", "user.name=Test Author", "-c", "user.email=example@example.test",
      "commit", "-q", "--allow-empty", "-F", "message.txt");
    const parsed = parseGitLog(git("log", "--format=" + format));
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].message, "Second commit");
    assert.equal(parsed[0].body, body);
    assert.equal(parsed[1].message, "First commit");
    assert.deepEqual(parsed[0].parents, [parsed[1].hash]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
