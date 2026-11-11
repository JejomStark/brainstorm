// State of a brainstorm session (`brainstorm.json`): creation, validation and
// rendering into an HTML page. The schema is described for the agent in
// reference/state-json.md.

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_SOURCES = ["flag", "detected", "page", "default"];

const PHASES = ["intake", "questions", "proposal", "review", "done"];
const QUESTION_KINDS = ["single", "multiple", "text"];
const STATE_LISTS = ["decided", "unclear", "assumptions", "risks"];
const DATA_PLACEHOLDER = "__BRAINSTORM_JSON__";
const I18N_PLACEHOLDER = "__BRAINSTORM_I18N__";
const CSS_PLACEHOLDER = "__BRAINSTORM_CSS__";
const SCRIPT_PLACEHOLDER = "__BRAINSTORM_JS__";
const LANG_PLACEHOLDER = "__BRAINSTORM_LANG__";
// Static strings of the template: {{t:key}} becomes the key's text in the session language.
const STATIC_STRING_RE = /\{\{t:([A-Za-z0-9_.]+)\}\}/g;

/**
 * Normalises a requested language ("fr", "FR", "fr-FR", "fr_CA") to a
 * supported code. An empty request gives the default language. Throws with
 * the list of supported codes otherwise.
 * @param {string | undefined} requested
 * @param {string[]} available
 * @returns {string}
 */
export function resolveLanguage(requested, available) {
  if (requested === undefined || requested.trim() === "") return DEFAULT_LANGUAGE;
  const code = requested.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (!available.includes(code)) {
    throw new Error(`Unsupported language "${requested}". Available: ${available.join(", ")}.`);
  }
  return code;
}

/**
 * Initial state: the page opens on the intake form.
 * @param {{ folder: string, folderLabel?: string, now: Date, lang?: string, langSource?: string }} options
 */
export function createInitialState({ folder, folderLabel, now, lang = DEFAULT_LANGUAGE, langSource = "default" }) {
  return {
    version: 1,
    title: "",
    lang,
    langSource,
    phase: "intake",
    folder,
    folderLabel: folderLabel ?? folder,
    createdAt: now.toISOString(),
    profile: null,
    round: 0,
    agentNote: "",
    summary: "",
    attachments: [],
    state: { decided: [], unclear: [], assumptions: [], glossary: [], risks: [] },
    questions: [],
    deliverables: { proposed: [], written: [] },
    history: [],
  };
}

/**
 * Lists the gaps between an object and the `brainstorm.json` schema.
 * Each message names the faulty field so the agent can fix it without guessing.
 * @param {unknown} candidate
 * @param {{ languages?: string[] }} [options] supported language codes
 * @returns {string[]}
 */
export function validateState(candidate, options = {}) {
  if (!isRecord(candidate)) return ["The root must be a JSON object."];
  const errors = [];
  if (candidate.version !== 1) errors.push("version must be 1.");
  if (typeof candidate.title !== "string") errors.push("title must be a string.");
  requireString(candidate, "folder", errors);
  errors.push(...validateLanguage(candidate, options.languages ?? [DEFAULT_LANGUAGE]));
  if (!PHASES.includes(String(candidate.phase))) errors.push(`phase must be one of: ${PHASES.join(", ")}.`);
  if (!Number.isInteger(candidate.round)) errors.push("round must be an integer.");
  errors.push(...validateStatePanel(candidate.state));
  errors.push(...validateQuestions(candidate.questions, candidate.phase));
  errors.push(...validateDeliverables(candidate.deliverables, candidate.phase));
  if (!Array.isArray(candidate.attachments)) errors.push("attachments must be an array.");
  return errors;
}

/**
 * @param {Record<string, unknown>} candidate
 * @param {string[]} languages
 */
function validateLanguage(candidate, languages) {
  const errors = [];
  if (!languages.includes(String(candidate.lang))) errors.push(`lang must be one of: ${languages.join(", ")}.`);
  if (candidate.langSource !== undefined && !LANGUAGE_SOURCES.includes(String(candidate.langSource))) {
    errors.push(`langSource must be one of: ${LANGUAGE_SOURCES.join(", ")}.`);
  }
  return errors;
}

/** @param {unknown} panel */
function validateStatePanel(panel) {
  if (!isRecord(panel)) return ["state must be an object (decided, unclear, assumptions, glossary, risks)."];
  const errors = [];
  for (const key of STATE_LISTS) {
    const list = panel[key];
    if (!Array.isArray(list) || list.some((item) => typeof item !== "string")) {
      errors.push(`state.${key} must be an array of strings.`);
    }
  }
  const glossary = panel.glossary;
  const isGlossaryValid = Array.isArray(glossary)
    && glossary.every((entry) => isRecord(entry) && typeof entry.term === "string" && typeof entry.definition === "string");
  if (!isGlossaryValid) errors.push("state.glossary must be an array of { term, definition }.");
  return errors;
}

/**
 * @param {unknown} questions
 * @param {unknown} phase
 */
function validateQuestions(questions, phase) {
  if (!Array.isArray(questions)) return ["questions must be an array."];
  const errors = [];
  if (phase === "questions" && (questions.length < 1 || questions.length > 6)) {
    errors.push(`In the questions phase, 1 to 6 questions are required (3 to 5 advised), got ${questions.length}.`);
  }
  const ids = new Set();
  questions.forEach((question, index) => {
    const where = `questions[${index}]`;
    if (!isRecord(question)) {
      errors.push(`${where} must be an object.`);
      return;
    }
    if (typeof question.id !== "string" || !question.id) errors.push(`${where}.id is missing.`);
    else if (ids.has(question.id)) errors.push(`${where}.id "${question.id}" is a duplicate.`);
    else ids.add(question.id);
    if (typeof question.title !== "string" || !question.title) errors.push(`${where}.title is missing.`);
    if (!QUESTION_KINDS.includes(String(question.kind))) errors.push(`${where}.kind must be single, multiple or text.`);
    if (question.kind !== "text") errors.push(...validateOptions(question.options, where));
  });
  return errors;
}

/**
 * @param {unknown} options
 * @param {string} where
 */
function validateOptions(options, where) {
  if (!Array.isArray(options) || options.length < 2) return [`${where}.options must offer at least 2 choices.`];
  const isValid = options.every((option) => isRecord(option) && typeof option.value === "string" && typeof option.label === "string");
  return isValid ? [] : [`${where}.options must contain { value, label } objects.`];
}

/**
 * @param {unknown} deliverables
 * @param {unknown} phase
 */
function validateDeliverables(deliverables, phase) {
  if (!isRecord(deliverables)) return ["deliverables must be an object { proposed, written }."];
  const { proposed, written } = deliverables;
  const errors = [];
  if (!Array.isArray(proposed)) errors.push("deliverables.proposed must be an array.");
  else if (phase === "proposal" && proposed.length === 0) errors.push("In the proposal phase, deliverables.proposed cannot be empty.");
  if (!Array.isArray(written)) {
    errors.push("deliverables.written must be an array.");
    return errors;
  }
  if (phase === "review" && written.length === 0) errors.push("In the review phase, deliverables.written cannot be empty.");
  written.forEach((item, index) => {
    const isValid = isRecord(item) && ["kind", "title", "path", "content"].every((key) => typeof item[key] === "string");
    if (!isValid) errors.push(`deliverables.written[${index}] must contain kind, title, path and content (strings).`);
  });
  return errors;
}

/**
 * Checks that every locale defines exactly the keys of the reference locale,
 * so a new language cannot ship with a missing or misspelled string.
 * @param {Record<string, Record<string, unknown>>} locales
 * @returns {string[]}
 */
export function validateLocales(locales) {
  const reference = locales[DEFAULT_LANGUAGE];
  if (!reference) return [`The ${DEFAULT_LANGUAGE} locale is required as the reference.`];
  const referenceKeys = Object.keys(reference);
  const errors = [];
  for (const [code, strings] of Object.entries(locales)) {
    const keys = Object.keys(strings);
    for (const key of referenceKeys) if (!keys.includes(key)) errors.push(`${code}: missing key "${key}".`);
    for (const key of keys) if (!referenceKeys.includes(key)) errors.push(`${code}: unknown key "${key}".`);
    for (const [key, value] of Object.entries(strings)) if (typeof value !== "string") errors.push(`${code}: "${key}" must be a string.`);
  }
  return errors;
}

/**
 * Serialises a value for a <script type="application/json"> block without
 * ever closing the tag that holds it.
 * @param {unknown} value
 */
function toInlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** @param {string} value */
function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Assembles the page: styles, scripts, translations and state inline, for a
 * self-contained page that loads no external resource.
 * @param {{ template: string, css: string, scripts: string[], locales: Record<string, Record<string, string>> }} assets
 * @param {Record<string, unknown>} state validated state
 */
export function renderPage(assets, state) {
  for (const placeholder of [DATA_PLACEHOLDER, I18N_PLACEHOLDER, CSS_PLACEHOLDER, SCRIPT_PLACEHOLDER]) {
    if (!assets.template.includes(placeholder)) {
      throw new Error(`The page template is missing the ${placeholder} marker.`);
    }
  }
  const lang = typeof state.lang === "string" && assets.locales[state.lang] ? state.lang : DEFAULT_LANGUAGE;
  const strings = assets.locales[lang] ?? {};
  const fallback = assets.locales[DEFAULT_LANGUAGE] ?? {};
  const script = `"use strict";\n${assets.scripts.join("\n")}`.replace(/<\/script/gi, "<\\/script");
  return assets.template
    .replace(STATIC_STRING_RE, (_match, key) => strings[key] ?? fallback[key] ?? key)
    .replace(LANG_PLACEHOLDER, () => escapeAttribute(lang))
    .replace(CSS_PLACEHOLDER, () => assets.css)
    .replace(SCRIPT_PLACEHOLDER, () => script)
    .replace(I18N_PLACEHOLDER, () => toInlineJson(assets.locales))
    .replace(DATA_PLACEHOLDER, () => toInlineJson(state));
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string[]} errors
 */
function requireString(record, key, errors) {
  if (typeof record[key] !== "string" || !record[key]) errors.push(`${key} must be a non-empty string.`);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
