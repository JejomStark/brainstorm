#!/usr/bin/env node
// Entry point of the /brainstorm skill.
//
//   node brainstorm.mjs init [--dir <folder>] [--lang <code> | --detected-lang <code>]
//                                    creates the session folder, renders the page, opens Lavish
//   node brainstorm.mjs render <folder>
//                                    validates brainstorm.json and regenerates page.html
//   node brainstorm.mjs wait <folder> [--reply <message>]
//                                    waits for the page feedback, saves the attachments
//   node brainstorm.mjs reply <folder> --reply <message>
//                                    final message in Lavish, without waiting
//   node brainstorm.mjs languages    lists the supported languages

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ATTACHMENTS_DIR, extractAttachments, formatSize } from "./attachments.mjs";
import { createInitialState, renderPage, resolveLanguage, validateLocales, validateState } from "./state.mjs";
import { openSession, pollFeedback, sendReply } from "./lavish-process.mjs";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_ROOT = path.join(SKILL_ROOT, "page");
const I18N_ROOT = path.join(PAGE_ROOT, "i18n");
// Concatenation order: each script relies on the previous ones.
const PAGE_SCRIPTS = ["i18n.js", "markdown.js", "picker.js", "app.js", "rounds.js"];
const STATE_FILE = "brainstorm.json";
const PAGE_FILE = "page.html";
const WORK_DIR = ".brainstorm";
const DELIVERABLES_DIR = "deliverables";

const USAGE = `Usage:
  brainstorm.mjs init [--dir <folder>] [--lang <code> | --detected-lang <code>]
  brainstorm.mjs render <folder>
  brainstorm.mjs wait <folder> [--reply <message>]
  brainstorm.mjs reply <folder> --reply <message>
  brainstorm.mjs languages`;

/**
 * @param {string[]} argv
 * @returns {{ command: string | undefined, positional: string[], flags: Map<string, string> }}
 */
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const positional = [];
  const flags = new Map();
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index] ?? "";
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined) throw new Error(`Option ${arg} expects a value.\n${USAGE}`);
    flags.set(arg.slice(2), value);
    index++;
  }
  return { command, positional, flags };
}

/**
 * Loads every page/i18n/<code>.json. Adding a language is adding one file.
 * @returns {Record<string, Record<string, string>>}
 */
export function loadLocales() {
  /** @type {Record<string, Record<string, string>>} */
  const locales = {};
  for (const file of readdirSync(I18N_ROOT).filter((name) => name.endsWith(".json")).sort()) {
    locales[path.basename(file, ".json")] = JSON.parse(readFileSync(path.join(I18N_ROOT, file), "utf8"));
  }
  const errors = validateLocales(locales);
  if (errors.length > 0) throw new Error(`Invalid translation files in ${I18N_ROOT}:\n- ${errors.join("\n- ")}`);
  return locales;
}

/** @param {Date} now */
function defaultFolderName(now) {
  const pad = (/** @type {number} */ value) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${date}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Path shown in the page: relative to the project when the session lives in
 * it, so a screenshot of the page does not reveal the user's home folder.
 * @param {string} folder
 */
function folderLabelFor(folder) {
  const relative = path.relative(process.cwd(), folder);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : folder;
}

/** @param {string | undefined} folderArg */
function requireFolder(folderArg) {
  if (!folderArg) throw new Error(`Missing session folder.\n${USAGE}`);
  const folder = path.resolve(folderArg);
  if (!existsSync(path.join(folder, STATE_FILE))) {
    throw new Error(`No ${STATE_FILE} in ${folder}: run "brainstorm.mjs init" first.`);
  }
  return folder;
}

/**
 * Validates brainstorm.json and rewrites page.html. Lavish reloads the page by itself.
 * @param {string} folder
 */
function renderFolder(folder) {
  const statePath = path.join(folder, STATE_FILE);
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch (error) {
    throw new Error(`${statePath} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const locales = loadLocales();
  const errors = validateState(state, { languages: Object.keys(locales) });
  if (errors.length > 0) {
    throw new Error(`${statePath} does not match the schema:\n- ${errors.join("\n- ")}`);
  }
  const pagePath = path.join(folder, PAGE_FILE);
  const assets = {
    template: readFileSync(path.join(PAGE_ROOT, "template.html"), "utf8"),
    css: readFileSync(path.join(PAGE_ROOT, "page.css"), "utf8"),
    scripts: PAGE_SCRIPTS.map((file) => readFileSync(path.join(PAGE_ROOT, file), "utf8")),
    locales,
  };
  writeFileSync(pagePath, renderPage(assets, state));
  return pagePath;
}

// Lavish's generic instructions ("edit page.html", "run lavish-axi poll again")
// would contradict the skill loop: they are replaced with the brainstorm instruction.
const LAVISH_NOISE_RE = /^(next_step|dom_snapshot|help(\[\d+\])?):.*$/gm;

const NEXT_STEP_AFTER_INIT = "brainstorm: the page is waiting for the request. Run \"brainstorm.mjs wait <folder>\" without --reply.";
const NEXT_STEP_AFTER_FEEDBACK = "brainstorm: update brainstorm.json (never page.html), run \"render\", then \"wait --reply <short message>\". Write every user-facing text in the session language (brainstorm.json \"lang\").";

/** @param {string} lavishOutput */
function stripLavishNoise(lavishOutput) {
  return lavishOutput.replace(LAVISH_NOISE_RE, "").replace(/\n{3,}/g, "\n\n").trimEnd();
}

/**
 * --lang is an explicit choice; --detected-lang is the agent's guess from the
 * user's message; neither gives the default language.
 * @param {Map<string, string>} flags
 * @param {string[]} available
 */
function chooseLanguage(flags, available) {
  const explicit = flags.get("lang");
  if (explicit) return { lang: resolveLanguage(explicit, available), langSource: "flag" };
  const detected = flags.get("detected-lang");
  if (detected && available.includes(detected.trim().toLowerCase().split(/[-_]/)[0] ?? "")) {
    return { lang: resolveLanguage(detected, available), langSource: "detected" };
  }
  return { lang: resolveLanguage(undefined, available), langSource: "default" };
}

/** @param {Map<string, string>} flags */
async function runInit(flags) {
  const now = new Date();
  const { lang, langSource } = chooseLanguage(flags, Object.keys(loadLocales()));
  const folder = path.resolve(flags.get("dir") ?? path.join(WORK_DIR, defaultFolderName(now)));
  if (existsSync(path.join(folder, STATE_FILE))) {
    throw new Error(`${folder} already holds a session: resume it with "render" then "wait".`);
  }
  mkdirSync(path.join(folder, ATTACHMENTS_DIR), { recursive: true });
  mkdirSync(path.join(folder, DELIVERABLES_DIR), { recursive: true });
  const state = createInitialState({ folder, folderLabel: folderLabelFor(folder), now, lang, langSource });
  writeFileSync(path.join(folder, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
  const pagePath = renderFolder(folder);
  const lavishOutput = await openSession(pagePath);
  process.stdout.write(`folder: ${folder}\npage: ${pagePath}\nlang: ${lang} (${langSource})\n\n${stripLavishNoise(lavishOutput)}\n\n${NEXT_STEP_AFTER_INIT}\n`);
}

/**
 * @param {string} folder
 * @param {string | undefined} reply
 */
async function runWait(folder, reply) {
  const pagePath = path.join(folder, PAGE_FILE);
  const raw = await pollFeedback(pagePath, reply);
  const { text, saved, inlineTexts } = extractAttachments(raw, folder);
  const sections = [stripLavishNoise(text)];
  if (saved.length > 0) {
    const lines = saved.map((file) => `- ${file.relativePath} (${file.mime || "unknown type"}, ${formatSize(file.size)})`);
    sections.push(`attachments saved in ${folder}:\n${lines.join("\n")}`);
  }
  for (const inline of inlineTexts) {
    sections.push(`----- content of ${inline.relativePath} -----\n${inline.content.trimEnd()}\n----- end of ${inline.relativePath} -----`);
  }
  if (/status: feedback/.test(text)) sections.push(NEXT_STEP_AFTER_FEEDBACK);
  process.stdout.write(`${sections.join("\n\n")}\n`);
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  switch (command) {
    case "init":
      await runInit(flags);
      return;
    case "render":
      process.stdout.write(`page regenerated: ${renderFolder(requireFolder(positional[0]))}\n`);
      return;
    case "wait":
      await runWait(requireFolder(positional[0]), flags.get("reply"));
      return;
    case "reply": {
      const message = flags.get("reply");
      if (!message) throw new Error(`reply expects --reply <message>.\n${USAGE}`);
      process.stdout.write(await sendReply(path.join(requireFolder(positional[0]), PAGE_FILE), message));
      return;
    }
    case "languages": {
      const locales = loadLocales();
      process.stdout.write(`${Object.entries(locales).map(([code, strings]) => `${code}\t${strings.languageName}`).join("\n")}\n`);
      return;
    }
    default:
      throw new Error(`Unknown command: ${command ?? "(none)"}.\n${USAGE}`);
  }
}

// Run only as a script, so the tests can import loadLocales. The skill is often
// reached through a symbolic link: compare real paths.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
