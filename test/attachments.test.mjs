import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { decodeAttachments, extractAttachments, formatSize, toSafeFileName } from "../skills/brainstorm/scripts/attachments.mjs";

/** @param {string} name @param {string} mime @param {Buffer} bytes */
function marker(name, mime, bytes) {
  return `[[brainstorm-file:${encodeURIComponent(name)}:${mime}:${bytes.length}:${bytes.toString("base64")}]]`;
}

test("decodeAttachments recovers each file byte for byte", () => {
  const pdf = Buffer.from("%PDF-1.4\n\u0000ÿ binary");
  const text = `before\n${marker("note: v2.md", "text/markdown", Buffer.from("# Title"))}\n${marker("doc.pdf", "application/pdf", pdf)}`;
  const files = decodeAttachments(text);
  assert.equal(files.length, 2);
  assert.equal(files[0]?.name, "note: v2.md");
  assert.deepEqual(files[1]?.bytes, pdf);
});

test("decodeAttachments rejects a marker whose size does not match", () => {
  const text = `[[brainstorm-file:a.txt:text/plain:99:${Buffer.from("abc").toString("base64")}]]`;
  assert.throws(() => decodeAttachments(text), /corrupted/);
});

test("decodeAttachments ignores the former cadrer marker", () => {
  const bytes = Buffer.from("abc");
  assert.deepEqual(decodeAttachments(`[[cadrer-piece:a.txt:text/plain:3:${bytes.toString("base64")}]]`), []);
});

test("toSafeFileName neutralises paths", () => {
  assert.equal(toSafeFileName("../../etc/passwd"), "passwd");
  assert.equal(toSafeFileName("..\\secret.txt"), "secret.txt");
  assert.equal(toSafeFileName(".env"), "_env");
  assert.equal(toSafeFileName("a<b>.md"), "a_b_.md");
});

test("extractAttachments writes the files, replaces the markers and copies short text", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "brainstorm-test-"));
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]);
  const raw = `prompt: "Need\\n${marker("notes.md", "text/markdown", Buffer.from("- point 1"))}\\n${marker("capture.png", "image/png", image)}"`;
  const result = extractAttachments(raw, folder);
  assert.equal(result.saved.length, 2);
  assert.deepEqual(readFileSync(path.join(folder, "attachments", "capture.png")), image);
  assert.match(result.text, /\[attachment saved: attachments\/notes\.md/);
  assert.doesNotMatch(result.text, /brainstorm-file/);
  assert.deepEqual(result.inlineTexts, [{ relativePath: "attachments/notes.md", content: "- point 1" }]);
});

test("extractAttachments does not duplicate an identical file and suffixes a different namesake", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "brainstorm-test-"));
  mkdirSync(path.join(folder, "attachments"));
  writeFileSync(path.join(folder, "attachments", "plan.md"), "version 1");
  const same = extractAttachments(marker("plan.md", "text/markdown", Buffer.from("version 1")), folder);
  assert.equal(same.saved[0]?.relativePath, "attachments/plan.md");
  const other = extractAttachments(marker("plan.md", "text/markdown", Buffer.from("version 2")), folder);
  assert.equal(other.saved[0]?.relativePath, "attachments/plan-2.md");
});

test("extractAttachments leaves the text intact when there is no file", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "brainstorm-test-"));
  assert.deepEqual(extractAttachments("nothing", folder), { text: "nothing", saved: [], inlineTexts: [] });
});

test("formatSize speaks to the agent in English units", () => {
  assert.equal(formatSize(512), "512 B");
  assert.equal(formatSize(2048), "2.0 KB");
  assert.equal(formatSize(3 * 1024 * 1024), "3.00 MB");
});
