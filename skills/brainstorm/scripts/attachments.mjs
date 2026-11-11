// Extraction of the attachments carried in the text of a Lavish feedback.
//
// The page encodes each file on a single line:
//   [[brainstorm-file:<URI-encoded name>:<MIME type>:<size>:<base64>]]
// Base64 holds no space or quote: it goes through the output of
// `lavish-axi poll` unchanged, whatever its format (text, JSON, TOON).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ATTACHMENTS_DIR = "attachments";

const MARKER_RE = /\[\[brainstorm-file:([^:\]]*):([^:\]]*):(\d+):([A-Za-z0-9+/=]*)\]\]/g;

// Above this size the text content is not copied into the output: the agent reads the file.
const INLINE_TEXT_MAX_BYTES = 40 * 1024;

const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".csv", ".tsv", ".json", ".yaml", ".yml", ".toml",
  ".xml", ".html", ".css", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".py", ".sh",
  ".sql", ".ini", ".env", ".log", ".rst", ".org",
]);

/**
 * Attachment decoded from a marker.
 * @typedef {{ name: string, mime: string, declaredSize: number, bytes: Buffer, marker: string }} DecodedFile
 */

/**
 * Finds and decodes every attachment marker of a text.
 * Fails if a marker is corrupted (decoded size differs from the announced size).
 * @param {string} text
 * @returns {DecodedFile[]}
 */
export function decodeAttachments(text) {
  const files = [];
  for (const match of text.matchAll(MARKER_RE)) {
    const [marker, encodedName = "", mime = "", sizeText = "0", base64 = ""] = match;
    const name = decodeURIComponent(encodedName);
    const bytes = Buffer.from(base64, "base64");
    const declaredSize = Number(sizeText);
    if (bytes.length !== declaredSize) {
      throw new Error(`Attachment "${name}" is corrupted: ${bytes.length} bytes decoded, ${declaredSize} announced.`);
    }
    files.push({ name, mime, declaredSize, bytes, marker });
  }
  return files;
}

/**
 * Safe file name: no path separator, no control character.
 * @param {string} name
 */
export function toSafeFileName(name) {
  const base = path.basename(name.replace(/\\/g, "/"));
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").replace(/^\.+/, "_");
  if (!cleaned) return "attachment";
  return cleaned.slice(0, 180);
}

/**
 * Tells whether an attachment can be copied as plain text into the agent output.
 * @param {DecodedFile} file
 */
export function isInlineText(file) {
  if (file.bytes.length > INLINE_TEXT_MAX_BYTES) return false;
  const extension = path.extname(file.name).toLowerCase();
  return file.mime.startsWith("text/") || TEXT_EXTENSIONS.has(extension);
}

/**
 * Picks a free path in the folder: reuses the existing file when its content
 * is identical, otherwise suffixes -2, -3…
 * @param {string} folder
 * @param {string} fileName
 * @param {Buffer} bytes
 * @returns {{ filePath: string, isAlreadyPresent: boolean }}
 */
function chooseFilePath(folder, fileName, bytes) {
  const digest = sha256(bytes);
  const extension = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length);
  for (let index = 1; index < 1000; index++) {
    const candidate = path.join(folder, index === 1 ? fileName : `${stem}-${index}${extension}`);
    if (!existsSync(candidate)) return { filePath: candidate, isAlreadyPresent: false };
    if (sha256(readFileSync(candidate)) === digest) return { filePath: candidate, isAlreadyPresent: true };
  }
  throw new Error(`Too many files named "${fileName}" in ${folder}.`);
}

/** @param {Buffer} bytes */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** @param {number} size */
export function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Saves the attachments of a Lavish feedback into `<sessionFolder>/attachments/`
 * and replaces each marker with a readable line (plus the content of a short text).
 * @param {string} text raw output of `lavish-axi poll`
 * @param {string} sessionFolder folder of the brainstorm session
 * @returns {{ text: string, saved: { name: string, relativePath: string, mime: string, size: number }[], inlineTexts: { relativePath: string, content: string }[] }}
 */
export function extractAttachments(text, sessionFolder) {
  const files = decodeAttachments(text);
  if (files.length === 0) return { text, saved: [], inlineTexts: [] };
  const attachmentsFolder = path.join(sessionFolder, ATTACHMENTS_DIR);
  mkdirSync(attachmentsFolder, { recursive: true });
  const saved = [];
  const inlineTexts = [];
  let cleaned = text;
  for (const file of files) {
    const { filePath, isAlreadyPresent } = chooseFilePath(attachmentsFolder, toSafeFileName(file.name), file.bytes);
    if (!isAlreadyPresent) writeFileSync(filePath, file.bytes);
    const relativePath = path.relative(sessionFolder, filePath);
    saved.push({ name: file.name, relativePath, mime: file.mime, size: file.bytes.length });
    if (isInlineText(file)) inlineTexts.push({ relativePath, content: file.bytes.toString("utf8") });
    const summary = `[attachment saved: ${relativePath} (${file.mime || "unknown type"}, ${formatSize(file.bytes.length)})]`;
    cleaned = cleaned.replace(file.marker, () => summary);
  }
  return { text: cleaned, saved, inlineTexts };
}
