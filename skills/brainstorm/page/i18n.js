// Interface language of the page. Every string comes from page/i18n/<code>.json,
// injected by `brainstorm.mjs render`. The session language is `lang` in
// brainstorm.json; the selector in the top bar can override it until the agent
// has switched the session to the chosen language.

const LOCALES = JSON.parse(document.getElementById("brainstorm-i18n").textContent);
const FALLBACK_LANG = "en";

function readLanguageOverride(baseLang, storageKey) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    // The override only holds while the session is still in the language it replaced.
    if (saved && saved.base === baseLang && LOCALES[saved.choice]) return saved.choice;
  } catch (error) {
    // Storage unavailable or unreadable: the page follows the session language.
  }
  return null;
}

function writeLanguageOverride(baseLang, choice, storageKey) {
  try {
    if (choice === baseLang) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify({ base: baseLang, choice }));
  } catch (error) {
    // Same reason as readLanguageOverride: the choice lasts until the next reload only.
  }
}

/** Language state for one session: base from brainstorm.json, optional page override. */
function createLanguage(baseLang, folder) {
  const storageKey = "brainstorm:lang:" + folder;
  const base = LOCALES[baseLang] ? baseLang : FALLBACK_LANG;
  let current = readLanguageOverride(base, storageKey) || base;
  return {
    base,
    current: () => current,
    isOverridden: () => current !== base,
    set(choice) {
      if (!LOCALES[choice]) return;
      current = choice;
      writeLanguageOverride(base, choice, storageKey);
    },
  };
}

function fillTemplate(template, vars, escapeValue) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (vars && name in vars ? escapeValue(String(vars[name])) : match));
}

function lookup(key) {
  const strings = LOCALES[language.current()] || {};
  const fallback = LOCALES[FALLBACK_LANG] || {};
  return key in strings ? strings[key] : key in fallback ? fallback[key] : key;
}

/** Plain text (prompt text, textContent, attribute values before escaping). */
function t(key, vars) {
  return fillTemplate(lookup(key), vars, (value) => value);
}

/** HTML: the translation itself is trusted markup, the variables are escaped. */
function h(key, vars) {
  return fillTemplate(lookup(key), vars, escapeHtml);
}

function formatBytes(size) {
  if (size < 1024) return t("unit.bytes", { n: size });
  if (size < 1024 * 1024) return t("unit.kilobytes", { n: (size / 1024).toFixed(1) });
  return t("unit.megabytes", { n: (size / 1024 / 1024).toFixed(2) });
}

/** First line of every submission: a fixed English tag the agent parses, plus the language. */
function promptHeader(tag) {
  const source = language.isOverridden() ? " (chosen in page)" : "";
  return "[brainstorm] " + tag + " · lang=" + language.current() + source;
}

function applyStaticStrings() {
  document.documentElement.lang = language.current();
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.innerHTML = lookup(element.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-label]").forEach((element) => {
    element.setAttribute("aria-label", lookup(element.getAttribute("data-i18n-label")));
  });
}

function renderLanguageSelect(onChange) {
  const container = document.getElementById("lang-select");
  const codes = Object.keys(LOCALES);
  if (codes.length < 2) {
    container.hidden = true;
    return;
  }
  container.innerHTML = '<label class="lang-label" for="lang-input">' + h("languageLabel") + "</label>" +
    '<select id="lang-input">' +
    codes.map((code) => '<option value="' + escapeHtml(code) + '"' + (code === language.current() ? " selected" : "") + ">" +
      escapeHtml(LOCALES[code].languageName) + "</option>").join("") +
    "</select>";
  container.querySelector("select").addEventListener("change", (event) => onChange(event.target.value));
}

function languageSwitchNote() {
  if (!language.isOverridden()) return "";
  return '<p class="lang-note" role="status">' + h("languageSwitchNote", { language: lookup("languageNameIn") }) + "</p>";
}
