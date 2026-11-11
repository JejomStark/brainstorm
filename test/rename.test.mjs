import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCli } from "./helpers.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("the skill sits where skills.sh looks for it and is named brainstorm", () => {
  const skill = readFileSync(path.join(ROOT, "skills", "brainstorm", "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: brainstorm\n/);
  assert.match(skill, /^disable-model-invocation: true$/m);
  assert.equal(JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).name, "brainstorm");
});

test("no tracked file outside the tests still carries the former name", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter((file) => file && !file.startsWith("test/") && !file.endsWith(".png") && !file.endsWith(".gif") && existsSync(path.join(ROOT, file)));
  const offenders = files.filter((file) => /cadrer|cadrage\.json|\.cadrer/i.test(readFileSync(path.join(ROOT, file), "utf8")));
  assert.deepEqual(offenders, []);
});

test("init creates .brainstorm/<timestamp>/ with brainstorm.json, attachments/ and deliverables/", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "brainstorm-cli-"));
  const result = runCli(["init"], cwd);
  assert.equal(result.status, 0, result.stderr);
  const [session = ""] = readdirSync(path.join(cwd, ".brainstorm"));
  assert.match(session, /^\d{4}-\d{2}-\d{2}-\d{6}$/);
  const folder = path.join(cwd, ".brainstorm", session);
  assert.deepEqual(readdirSync(folder).sort(), ["attachments", "brainstorm.json", "deliverables", "page.html"]);
  const state = JSON.parse(readFileSync(path.join(folder, "brainstorm.json"), "utf8"));
  assert.equal(state.folderLabel, path.join(".brainstorm", session));
  assert.doesNotMatch(result.stdout, /next_step: edit the page/);
  assert.match(result.stdout, /brainstorm: the page is waiting for the request/);
});

test("render reports schema errors in English, field by field", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "brainstorm-cli-"));
  runCli(["init", "--dir", "s"], cwd);
  const statePath = path.join(cwd, "s", "brainstorm.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  state.phase = "questions";
  execFileSync(process.execPath, ["-e", `require("fs").writeFileSync(${JSON.stringify(statePath)}, ${JSON.stringify(JSON.stringify(state))})`]);
  const result = runCli(["render", "s"], cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /In the questions phase, 1 to 6 questions are required/);
});
