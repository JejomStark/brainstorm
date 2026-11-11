import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createInitialState, renderPage, resolveLanguage, validateLocales, validateState } from "../skills/brainstorm/scripts/state.mjs";
import { loadLocales } from "../skills/brainstorm/scripts/brainstorm.mjs";
import { runCli } from "./helpers.mjs";

const NOW = new Date("2026-10-31T12:00:00Z");
const PAGE = new URL("../skills/brainstorm/page/", import.meta.url);
const locales = loadLocales();

/** @param {string} lang */
function renderIntake(lang) {
  const template = readFileSync(new URL("template.html", PAGE), "utf8");
  return renderPage({ template, css: "", scripts: [], locales }, createInitialState({ folder: "/tmp/session", now: NOW, lang }));
}

/** @param {string} folder */
function readSession(folder) {
  const [session] = readdirSync(path.join(folder, ".brainstorm"));
  return JSON.parse(readFileSync(path.join(folder, ".brainstorm", session ?? "", "brainstorm.json"), "utf8"));
}

test("English and French are shipped, English is the default", () => {
  assert.deepEqual(Object.keys(locales), ["en", "fr"]);
  assert.equal(createInitialState({ folder: "/tmp/session", now: NOW }).lang, "en");
});

test("resolveLanguage normalises codes and lists the supported ones", () => {
  assert.equal(resolveLanguage("fr", ["en", "fr"]), "fr");
  assert.equal(resolveLanguage("FR", ["en", "fr"]), "fr");
  assert.equal(resolveLanguage("fr-FR", ["en", "fr"]), "fr");
  assert.equal(resolveLanguage("en_GB", ["en", "fr"]), "en");
  assert.equal(resolveLanguage(undefined, ["en", "fr"]), "en");
  assert.equal(resolveLanguage("  ", ["en", "fr"]), "en");
  assert.throws(() => resolveLanguage("de", ["en", "fr"]), /Unsupported language "de"\. Available: en, fr\./);
});

test("validateState checks lang and langSource", () => {
  const state = createInitialState({ folder: "/tmp/session", now: NOW, lang: "fr", langSource: "flag" });
  assert.deepEqual(validateState(state, { languages: ["en", "fr"] }), []);
  assert.ok(validateState({ ...state, lang: "de" }, { languages: ["en", "fr"] }).includes("lang must be one of: en, fr."));
  assert.ok(validateState({ ...state, langSource: "guess" }, { languages: ["en", "fr"] }).some((error) => error.startsWith("langSource must be one of")));
});

test("every translation file defines exactly the keys of en.json", () => {
  assert.deepEqual(validateLocales(locales), []);
  const broken = { en: { a: "A", b: "B" }, fr: { a: "A", c: "C" } };
  assert.deepEqual(validateLocales(broken), ["fr: missing key \"b\".", "fr: unknown key \"c\"."]);
});

test("every string key used by the page scripts exists", () => {
  const source = ["i18n.js", "app.js", "picker.js", "rounds.js"].map((file) => readFileSync(new URL(file, PAGE), "utf8")).join("\n");
  const used = new Set([...source.matchAll(/\b(?:t|h|lookup)\("([A-Za-z0-9_.]+)"[,)]/g)].map((match) => match[1]));
  for (const phase of ["intake", "questions", "proposal", "review", "done"]) used.add(`step.${phase}`);
  for (const kind of ["spec", "adr", "prd", "issue", "plan", "brief", "context", "other"]) used.add(`deliverable.${kind}`);
  for (const profile of ["product", "technical", "content"]) used.add(`profile.${profile}`);
  const missing = [...used].filter((key) => !(key in (locales.en ?? {})));
  assert.deepEqual(missing, []);
  assert.ok(used.size > 100, `only ${used.size} keys found: the extraction regexp is probably broken`);
});

test("the page is rendered in the session language", () => {
  const english = renderIntake("en");
  assert.match(english, /<html lang="en"/);
  assert.match(english, /<h1 id="page-title">New brainstorm<\/h1>/);
  const french = renderIntake("fr");
  assert.match(french, /<html lang="fr"/);
  assert.match(french, /<h1 id="page-title">Nouveau cadrage<\/h1>/);
  assert.match(french, /class="mode-hint"[^>]*>La page s'ouvre en mode Explore/);
  assert.match(french, /aria-label="État du cadrage"/);
});

test("the French interface keeps the wording of the former French-only page", () => {
  const fr = locales.fr ?? {};
  const expected = {
    "intake.title": "Expliquez votre besoin",
    "intake.submit": "Lancer le cadrage",
    "round.submit": "Envoyer mes réponses",
    "round.lead": "Ma recommandation est pré-cochée. Changez ce qui ne vous va pas, puis envoyez tout d'un coup.",
    "answer.accepted": " [recommandation acceptée]",
    "proposal.title": "Tout est clair : quel livrable écrire ?",
    "review.approve": "Valider",
    "panel.title": "État du cadrage",
    "waiting.body": "L'agent lit vos réponses et prépare la suite ; la page se mettra à jour toute seule.",
    "unit.kilobytes": "{n} Ko",
  };
  for (const [key, value] of Object.entries(expected)) assert.equal(fr[key], value, key);
});

test("init --lang fr starts a French session chosen by flag", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "brainstorm-cli-"));
  const result = runCli(["init", "--lang", "fr"], cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /lang: fr \(flag\)/);
  const state = readSession(cwd);
  assert.equal(state.lang, "fr");
  assert.equal(state.langSource, "flag");
});

test("init --detected-lang uses the agent's guess, and falls back to English when unsupported", () => {
  const french = mkdtempSync(path.join(tmpdir(), "brainstorm-cli-"));
  assert.equal(runCli(["init", "--detected-lang", "fr-CA"], french).status, 0);
  assert.deepEqual([readSession(french).lang, readSession(french).langSource], ["fr", "detected"]);
  const german = mkdtempSync(path.join(tmpdir(), "brainstorm-cli-"));
  assert.equal(runCli(["init", "--detected-lang", "de"], german).status, 0);
  assert.deepEqual([readSession(german).lang, readSession(german).langSource], ["en", "default"]);
});

test("init without a language gives English, an unknown --lang is refused", () => {
  const plain = mkdtempSync(path.join(tmpdir(), "brainstorm-cli-"));
  assert.equal(runCli(["init"], plain).status, 0);
  assert.deepEqual([readSession(plain).lang, readSession(plain).langSource], ["en", "default"]);
  const refused = runCli(["init", "--lang", "de"], mkdtempSync(path.join(tmpdir(), "brainstorm-cli-")));
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Available: en, fr/);
});

test("languages lists every translation file", () => {
  const result = runCli(["languages"], tmpdir());
  assert.equal(result.stdout, "en\tEnglish\nfr\tFrançais\n");
});
