// Views of the brainstorm page. The state comes from brainstorm.json (injected
// by `brainstorm.mjs render`); each submission goes out as a single Lavish prompt.

const STEPS = ["intake", "questions", "proposal", "review", "done"];
const DELIVERABLE_KINDS = ["spec", "adr", "prd", "issue", "plan", "brief", "context", "other"];

const dataText = document.getElementById("brainstorm-data").textContent;
const data = JSON.parse(dataText);
const language = createLanguage(data.lang, data.folder);
const main = document.getElementById("main");
// The key changes as soon as the agent rewrites the state: the page never stays stuck waiting.
const sentKey = "brainstorm:sent:" + hashText(dataText);

function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

function readSentFlag() {
  try {
    return window.localStorage.getItem(sentKey) === "1";
  } catch (error) {
    // Storage unavailable (private browsing): the page stays usable, without submission memory.
    return false;
  }
}

function writeSentFlag() {
  try {
    window.localStorage.setItem(sentKey, "1");
  } catch (error) {
    // Same reason as readSentFlag: the submission is done, only the local memory is missing.
  }
}

function folderLabel() {
  return data.folderLabel || data.folder;
}

function deliverableLabel(kind) {
  return DELIVERABLE_KINDS.includes(kind) ? t("deliverable." + kind) : kind;
}

function listOrEmpty(items, emptyKey) {
  if (!items.length) return '<p class="empty">' + h(emptyKey) + "</p>";
  return "<ul>" + items.map((item) => "<li>" + renderInline(item) + "</li>").join("") + "</ul>";
}

function renderStepper() {
  const currentIndex = STEPS.indexOf(data.phase);
  document.getElementById("stepper").innerHTML = STEPS.map((phase, index) => {
    const cls = index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : "";
    const suffix = phase === "questions" && data.round > 0 ? h("step.round", { n: data.round }) : "";
    return '<li class="' + cls + '"' + (index === currentIndex ? ' aria-current="step"' : "") + ">" + h("step." + phase) + suffix + "</li>";
  }).join("");
  const title = data.title || t("defaultTitle");
  document.getElementById("page-title").textContent = title;
  document.title = title + " · brainstorm";
}

function renderAttachmentsSection() {
  if (!data.attachments.length) return '<p class="empty">' + h("panel.attachmentsEmpty") + "</p>";
  return "<ul>" + data.attachments.map((file) => {
    const isImage = /\.(png|jpe?g|webp|gif)$/i.test(file.path || "");
    const thumb = isImage ? '<img class="thumb" src="' + escapeHtml(file.path) + '" alt="' + escapeHtml(file.name) + '">' : "";
    const note = file.note ? '<br><span class="hint">' + renderInline(file.note) + "</span>" : "";
    return "<li><strong>" + escapeHtml(file.name) + '</strong> <span class="mono">' + escapeHtml(file.path || "") + "</span>" + note + thumb + "</li>";
  }).join("") + "</ul>";
}

function renderHistorySection() {
  if (!data.history || !data.history.length) return "";
  const rounds = data.history.map((round) =>
    '<details class="history-round"><summary>' + h("panel.historyRound", { n: round.round }) + "</summary><ul>" +
    round.items.map((item) => "<li><strong>" + escapeHtml(item.question) + "</strong> : " + renderInline(item.answer) + "</li>").join("") +
    "</ul></details>").join("");
  return "<section><h3>" + h("panel.history") + "</h3>" + rounds + "</section>";
}

function profileBadge() {
  if (!data.profile) return "";
  const known = ["product", "technical", "content"].includes(data.profile);
  const name = known ? t("profile." + data.profile) : data.profile;
  return '<span class="badge reco">' + h("panel.profile", { name }) + "</span>";
}

function renderPanel() {
  const state = data.state;
  const openCount = data.phase === "questions" ? data.questions.length : 0;
  // Before the first analysis, an empty panel does not mean "all clear".
  const isIntake = data.phase === "intake";
  const glossary = state.glossary.length
    ? "<dl>" + state.glossary.map((entry) => "<dt>" + escapeHtml(entry.term) + "</dt><dd>" + renderInline(entry.definition) + "</dd>").join("") + "</dl>"
    : '<p class="empty">' + h("panel.glossaryEmpty") + "</p>";
  document.getElementById("panel").innerHTML =
    "<h2>" + h("panel.title") + "</h2>" +
    '<div class="panel-meta">' + profileBadge() +
    '<span class="badge">' + h("panel.decidedCount", { n: state.decided.length }) + "</span>" +
    (isIntake ? "" : '<span class="badge ' + (state.unclear.length ? "warn" : "ok") + '">' + h("panel.unclearCount", { n: state.unclear.length }) + "</span>") +
    (openCount ? '<span class="badge warn">' + h("panel.openCount", { n: openCount }) + "</span>" : "") +
    "</div>" +
    "<section><h3>" + h("panel.need") + "</h3>" + (data.summary ? "<p>" + renderInline(data.summary) + "</p>" : '<p class="empty">' + h("panel.needEmpty") + "</p>") + "</section>" +
    '<section><h3><span class="dot ok"></span>' + h("panel.decided") + "</h3>" + listOrEmpty(state.decided, "panel.decidedEmpty") + "</section>" +
    '<section><h3><span class="dot warn"></span>' + h("panel.unclear") + "</h3>" + listOrEmpty(state.unclear, isIntake ? "panel.unclearIntake" : "panel.unclearEmpty") + "</section>" +
    '<section><h3><span class="dot info"></span>' + h("panel.assumptions") + "</h3>" + listOrEmpty(state.assumptions, "panel.assumptionsEmpty") + "</section>" +
    "<section><h3>" + h("panel.glossary") + "</h3>" + glossary + "</section>" +
    '<section><h3><span class="dot risk"></span>' + h("panel.risks") + "</h3>" + listOrEmpty(state.risks, "panel.risksEmpty") + "</section>" +
    "<section><h3>" + h("panel.attachments") + "</h3>" + renderAttachmentsSection() + "</section>" +
    renderHistorySection() +
    "<section><h3>" + h("panel.folder") + '</h3><p class="mono">' + escapeHtml(folderLabel()) + "</p></section>";
}

function agentNoteCard() {
  const note = data.agentNote ? '<div class="card agent-note"><div class="who">' + h("agent") + '</div><div class="prose">' + renderMarkdown(data.agentNote) + "</div></div>" : "";
  return languageSwitchNote() + note;
}

function waitingCard() {
  return '<div class="card"><div class="sent-banner"><span class="spinner" aria-hidden="true"></span>' +
    "<div><strong>" + h("waiting.title") + "</strong> " + h("waiting.body") + "</div></div></div>";
}

function describeAttachmentReport(report) {
  if (!report.length) return "";
  const lines = report.map((item) => {
    const where = item.sent ? item.note : t("send.copyTo", { note: item.note, folder: folderLabel() });
    return "- " + item.name + " (" + (item.type || t("send.unknownType")) + ", " + formatBytes(item.size) + ") : " + where;
  });
  return "\n\n" + t("send.attachmentsHeading", { n: report.length }) + "\n" + lines.join("\n");
}

/**
 * Sends a single prompt to the agent, files included, then switches the page to waiting.
 * Outside Lavish, shows the text to copy (without the files, which only travel through Lavish).
 */
async function sendToAgent({ form, tag, summary, buildText, picker }) {
  const button = form.querySelector("button[type=submit]");
  const status = form.querySelector(".status");
  button.disabled = true;
  status.classList.remove("is-error");
  status.textContent = t("send.preparing");
  try {
    const files = picker ? picker.files() : [];
    if (!window.lavish || typeof window.lavish.queuePrompt !== "function") {
      // Without Lavish no file can travel: each one has to be added by hand.
      const report = files.map((file) => ({ name: file.name, size: file.size, type: file.type, sent: false, note: t("send.standaloneFile") }));
      showStandaloneFallback(form, buildText() + describeAttachmentReport(report));
      button.disabled = false;
      return;
    }
    const encoded = await encodeAttachments(files);
    const text = buildText() + describeAttachmentReport(encoded.report);
    // The markers also show in the Lavish conversation: a heading explains this
    // unreadable block to the user, meant for the agent's script.
    const prompt = encoded.markers.length ? text + "\n\n" + t("send.encodedHeading") + "\n" + encoded.markers.join("\n") : text;
    window.lavish.queuePrompt(prompt, { tag, text: summary, element: form });
    window.lavish.sendQueuedPrompts();
    writeSentFlag();
    main.innerHTML = agentNoteCard() + waitingCard();
  } catch (error) {
    status.classList.add("is-error");
    status.textContent = t("send.failed", { error: error && error.message ? error.message : String(error) });
    button.disabled = false;
  }
}

function showStandaloneFallback(form, text) {
  const status = form.querySelector(".status");
  status.textContent = t("send.standalone");
  let area = form.querySelector(".fallback-text");
  if (!area) {
    area = document.createElement("textarea");
    area.className = "fallback-text";
    area.readOnly = true;
    area.rows = 10;
    form.appendChild(area);
  }
  area.value = text;
  area.select();
}

function optionalHint() {
  return ' <span class="hint">' + h("intake.optional") + "</span>";
}

function renderIntake() {
  const expectedOptions = ["spec", "adr", "prd", "issue", "plan", "brief"]
    .map((kind) => '<option value="' + kind + '">' + h("deliverable." + kind) + "</option>").join("");
  main.innerHTML = agentNoteCard() +
    '<form class="card" id="intake-form" data-lavish-question="request">' +
    "<h2>" + h("intake.title") + "</h2>" +
    '<p class="lead">' + h("intake.lead") + "</p>" +
    '<label class="field" for="need">' + h("intake.need") + "</label>" +
    '<textarea id="need" name="need" class="big" required placeholder="' + escapeHtml(t("intake.needPlaceholder")) + '"></textarea>' +
    '<div class="row">' +
    '<div><label class="field" for="profile">' + h("intake.profile") + optionalHint() + "</label>" +
    '<select id="profile" name="profile"><option value="">' + h("intake.profileAuto") + "</option>" +
    '<option value="product">' + h("intake.profileProduct") + '</option><option value="technical">' + h("intake.profileTechnical") + "</option>" +
    '<option value="content">' + h("intake.profileContent") + "</option></select></div>" +
    '<div><label class="field" for="expected">' + h("intake.expected") + optionalHint() + "</label>" +
    '<select id="expected" name="expected"><option value="">' + h("intake.expectedUnknown") + "</option>" + expectedOptions + "</select></div>" +
    "</div>" +
    '<label class="field">' + h("intake.attachments") + optionalHint() + "</label>" +
    '<div id="intake-picker"></div>' +
    '<div class="actions"><button type="submit" class="btn primary">' + h("intake.submit") + '</button><span class="status" role="status"></span></div>' +
    "</form>";
  const form = document.getElementById("intake-form");
  const picker = createAttachmentPicker(document.getElementById("intake-picker"), "intake");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const need = form.need.value.trim();
    if (!need) {
      form.querySelector(".status").textContent = t("intake.needMissing");
      return;
    }
    const count = picker.files().length;
    sendToAgent({
      form, picker, tag: "brainstorm-request",
      summary: t("intake.summary") + (count ? t("intake.summaryFiles", { n: count }) : ""),
      buildText: () => promptHeader("intake") + "\n" +
        t("intake.textProfile", { value: form.profile.value || t("intake.textProfileAuto") }) + "\n" +
        t("intake.textExpected", { value: form.expected.value || t("intake.textExpectedUnknown") }) + "\n\n" +
        t("intake.textNeed") + "\n" + need,
    });
  });
}
