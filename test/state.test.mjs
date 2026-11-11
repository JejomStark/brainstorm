import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createInitialState, renderPage, validateState } from "../skills/brainstorm/scripts/state.mjs";
import { loadLocales } from "../skills/brainstorm/scripts/brainstorm.mjs";

const NOW = new Date("2026-10-31T12:00:00Z");
const LANGUAGES = ["en", "fr"];
const TEMPLATE = "<style>__BRAINSTORM_CSS__</style><script type=\"application/json\">__BRAINSTORM_I18N__</script><script type=\"application/json\">__BRAINSTORM_JSON__</script><script>__BRAINSTORM_JS__</script>";

function questionsState() {
  const state = createInitialState({ folder: "/tmp/session", now: NOW });
  state.phase = "questions";
  state.round = 1;
  state.questions = [
    { id: "Q1", title: "Who is it for?", kind: "single", options: [{ value: "me", label: "Me" }, { value: "team", label: "The team" }], recommended: "me" },
    { id: "Q2", title: "Constraints?", kind: "text", recommended: "None" },
  ];
  return state;
}

test("the initial state is valid", () => {
  assert.deepEqual(validateState(createInitialState({ folder: "/tmp/session", now: NOW }), { languages: LANGUAGES }), []);
});

test("a well-formed question round is valid", () => {
  assert.deepEqual(validateState(questionsState(), { languages: LANGUAGES }), []);
});

test("validation names the faulty fields precisely", () => {
  const state = questionsState();
  state.questions.push({ id: "Q1", title: "", kind: "choice", options: [] });
  state.state.decided = [42];
  const errors = validateState(state);
  assert.ok(errors.includes("questions[2].id \"Q1\" is a duplicate."));
  assert.ok(errors.includes("questions[2].title is missing."));
  assert.ok(errors.includes("questions[2].kind must be single, multiple or text."));
  assert.ok(errors.includes("state.decided must be an array of strings."));
});

test("the proposal and review phases require their deliverables", () => {
  const proposal = createInitialState({ folder: "/tmp/session", now: NOW });
  proposal.phase = "proposal";
  assert.ok(validateState(proposal).some((error) => error.includes("deliverables.proposed")));
  const review = createInitialState({ folder: "/tmp/session", now: NOW });
  review.phase = "review";
  assert.ok(validateState(review).some((error) => error.includes("deliverables.written")));
});

test("renderPage injects everything and never lets a script tag close", () => {
  const state = questionsState();
  state.summary = "</script><script>alert(1)</script>";
  const html = renderPage({ template: TEMPLATE, css: "body{}", scripts: ["const marker = '</script>';"], locales: { en: { brand: "</script>" } } }, state);
  assert.doesNotMatch(html, /__BRAINSTORM_/);
  assert.equal(html.match(/<\/script>/g)?.length, 3);
  const blocks = [...html.matchAll(/<script type="application\/json">(.*?)<\/script>/g)].map((match) => match[1] ?? "");
  assert.equal(JSON.parse(blocks[1] ?? "").summary, state.summary);
  assert.equal(JSON.parse(blocks[0] ?? "").en.brand, "</script>");
});

test("renderPage fails if the template lost a marker", () => {
  assert.throws(() => renderPage({ template: "<html></html>", css: "", scripts: [], locales: {} }, {}), /__BRAINSTORM_JSON__/);
});

test("the page opens in Lavish Explore mode and explains how to annotate", () => {
  const template = readFileSync(new URL("../skills/brainstorm/page/template.html", import.meta.url), "utf8");
  const html = renderPage({ template, css: "", scripts: [], locales: loadLocales() }, createInitialState({ folder: "/tmp/session", now: NOW }));
  assert.match(html, /<html lang="en" data-lavish-annotate="off">/);
  assert.match(html, /class="mode-hint"[^>]*>The page opens in Explore mode/);
});
