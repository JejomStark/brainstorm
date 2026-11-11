// Views of the question rounds, the deliverable proposal and the review,
// then page start-up and language switching.

const OTHER_VALUE = "__other";

function isRecommended(question, value) {
  const reco = question.recommended;
  return Array.isArray(reco) ? reco.includes(value) : reco === value;
}

function questionControls(question) {
  if (question.kind === "text") {
    const value = typeof question.recommended === "string" ? question.recommended : "";
    const hint = value ? '<p class="hint">' + h("question.prefilled") + "</p>" : "";
    return hint + '<textarea name="' + escapeHtml(question.id) + '" aria-label="' + escapeHtml(question.title) + '">' + escapeHtml(value) + "</textarea>";
  }
  const type = question.kind === "multiple" ? "checkbox" : "radio";
  const options = question.options.map((option) => {
    const checked = isRecommended(question, option.value) ? " checked" : "";
    const reco = checked ? ' <span class="badge reco">' + h("question.recommended") + "</span>" : "";
    const hint = option.hint ? '<span class="opt-hint">' + renderInline(option.hint) + "</span>" : "";
    return '<label class="option"><input type="' + type + '" name="' + escapeHtml(question.id) + '" value="' + escapeHtml(option.value) + '"' + checked + ">" +
      '<span class="opt-text">' + renderInline(option.label) + reco + hint + "</span></label>";
  }).join("");
  const other = '<label class="option"><input type="' + type + '" name="' + escapeHtml(question.id) + '" value="' + OTHER_VALUE + '">' +
    '<span class="opt-text">' + h("question.other") + "</span></label>" +
    '<input type="text" class="other-input" name="' + escapeHtml(question.id) + '-other" aria-label="' + escapeHtml(t("question.otherLabel", { id: question.id })) +
    '" placeholder="' + escapeHtml(t("question.otherPlaceholder")) + '">';
  return options + other;
}

function questionFieldset(question) {
  const body = question.body ? '<div class="qbody">' + renderMarkdown(question.body) + "</div>" : "";
  const why = question.why ? '<p class="why">' + h("question.why") + renderInline(question.why) + "</p>" : "";
  return '<fieldset class="question" data-lavish-question="' + escapeHtml(question.id) + '">' +
    '<legend><span class="qid">' + escapeHtml(question.id) + "</span>" + escapeHtml(question.title) + "</legend>" +
    body + why + questionControls(question) +
    '<details class="more"><summary>' + h("question.addNote") + "</summary>" +
    '<textarea name="' + escapeHtml(question.id) + '-note" aria-label="' + escapeHtml(t("question.noteLabel", { id: question.id })) + '"></textarea></details>' +
    "</fieldset>";
}

function optionLabel(question, value) {
  const option = (question.options || []).find((candidate) => candidate.value === value);
  return option ? option.label : value;
}

// Reads a question's answer as checked at submission time.
function readAnswer(form, question) {
  const note = form.elements[question.id + "-note"].value.trim();
  if (question.kind === "text") {
    const text = form.elements[question.id].value.trim();
    return { text: text || t("answer.none"), isReco: !!text && text === question.recommended, note };
  }
  const checked = [...form.querySelectorAll('input[name="' + CSS.escape(question.id) + '"]:checked')].map((input) => input.value);
  const other = form.elements[question.id + "-other"].value.trim();
  const labels = checked.map((value) => (value === OTHER_VALUE ? t("answer.other", { text: other || t("answer.otherEmpty") }) : optionLabel(question, value)));
  const reco = Array.isArray(question.recommended) ? question.recommended : [question.recommended];
  const isReco = checked.length > 0 && checked.length === reco.length && checked.every((value) => reco.includes(value));
  return { text: labels.length ? labels.join(" ; ") : t("answer.none"), isReco, note };
}

function renderQuestions() {
  main.innerHTML = agentNoteCard() +
    '<form class="card" id="round-form">' +
    "<h2>" + h("round.title", { n: data.round, count: data.questions.length }) + "</h2>" +
    '<p class="lead">' + h("round.lead") + "</p>" +
    data.questions.map(questionFieldset).join("") +
    '<details class="more"><summary>' + h("round.more") + "</summary>" +
    '<textarea name="remark" aria-label="' + escapeHtml(t("round.remarkLabel")) + '" placeholder="' + escapeHtml(t("round.remarkPlaceholder")) + '"></textarea>' +
    '<div id="round-picker"></div></details>' +
    '<div class="actions"><button type="submit" class="btn primary">' + h("round.submit") + '</button><span class="status" role="status"></span></div>' +
    "</form>";
  const form = document.getElementById("round-form");
  const picker = createAttachmentPicker(document.getElementById("round-picker"), "round");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendToAgent({
      form, picker, tag: "brainstorm-answers",
      summary: t("round.summary", { n: data.round }),
      buildText: () => {
        const blocks = data.questions.map((question) => {
          const answer = readAnswer(form, question);
          return question.id + " · " + question.title + "\n→ " + answer.text + (answer.isReco ? t("answer.accepted") : "") +
            (answer.note ? "\n  " + t("answer.note", { text: answer.note }) : "");
        });
        const remark = form.remark.value.trim();
        return promptHeader("answers · round " + data.round) + "\n\n" + blocks.join("\n\n") + (remark ? "\n\n" + t("round.textRemark", { text: remark }) : "");
      },
    });
  });
}

function renderProposal() {
  const items = data.deliverables.proposed.map((item) => {
    const label = item.label || deliverableLabel(item.kind);
    const reco = item.recommended ? ' <span class="badge reco">' + h("question.recommended") + "</span>" : "";
    const reason = item.reason ? '<span class="opt-hint">' + renderInline(item.reason) + "</span>" : "";
    return '<label class="option"><input type="checkbox" name="deliverable" value="' + escapeHtml(item.kind) + '" data-label="' + escapeHtml(label) + '"' + (item.recommended ? " checked" : "") + ">" +
      '<span class="opt-text"><strong>' + escapeHtml(label) + "</strong>" + reco + reason + "</span></label>";
  }).join("");
  main.innerHTML = agentNoteCard() +
    '<form class="card" id="proposal-form" data-lavish-question="deliverables">' +
    "<h2>" + h("proposal.title") + "</h2>" +
    '<p class="lead">' + h("proposal.lead", { folder: folderLabel() }) + "</p>" +
    items +
    '<label class="field" for="other-deliverable">' + h("proposal.other") + optionalHint() + "</label>" +
    '<input type="text" id="other-deliverable" name="otherDeliverable" placeholder="' + escapeHtml(t("proposal.otherPlaceholder")) + '">' +
    '<label class="field" for="still-unclear">' + h("proposal.unclear") + ' <span class="hint">' + h("proposal.unclearHint") + "</span></label>" +
    '<textarea id="still-unclear" name="stillUnclear"></textarea>' +
    '<div class="actions"><button type="submit" class="btn primary">' + h("proposal.submit") + '</button><span class="status" role="status"></span></div>' +
    "</form>";
  const form = document.getElementById("proposal-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const chosen = [...form.querySelectorAll("input[name=deliverable]:checked")].map((input) => input.dataset.label + " (" + input.value + ")");
    const other = form.otherDeliverable.value.trim();
    const unclear = form.stillUnclear.value.trim();
    if (!chosen.length && !other && !unclear) {
      form.querySelector(".status").textContent = t("proposal.missing");
      return;
    }
    const toWrite = chosen.concat(other ? [t("proposal.textOther", { text: other })] : []);
    sendToAgent({
      form, tag: "brainstorm-deliverables",
      summary: unclear ? t("proposal.summaryUnclear") : t("proposal.summary", { list: chosen.concat(other ? [other] : []).join(", ") }),
      buildText: () => promptHeader("deliverables") + "\n" + t("proposal.textWrite", { list: toWrite.join(" ; ") || t("proposal.textNone") }) +
        (unclear ? "\n" + t("proposal.textUnclear", { text: unclear }) : ""),
    });
  });
}

function renderDeliverableArticles() {
  return data.deliverables.written.map((item) =>
    '<article class="card deliverable"><div class="deliverable-head"><span class="badge reco">' + escapeHtml(deliverableLabel(item.kind)) + "</span>" +
    "<strong>" + escapeHtml(item.title) + '</strong><span class="mono">' + escapeHtml(item.path) + "</span></div>" +
    '<div class="prose">' + renderMarkdown(item.content) + "</div></article>").join("");
}

function renderReview() {
  main.innerHTML = agentNoteCard() + renderDeliverableArticles() +
    '<form class="card" id="review-form" data-lavish-question="review">' +
    "<h2>" + h("review.title") + "</h2>" +
    '<p class="lead">' + h("review.lead") + "</p>" +
    '<label class="option"><input type="radio" name="verdict" value="approved" checked><span class="opt-text"><strong>' + h("review.approve") + '</strong><span class="opt-hint">' + h("review.approveHint") + "</span></span></label>" +
    '<label class="option"><input type="radio" name="verdict" value="changes"><span class="opt-text"><strong>' + h("review.change") + '</strong><span class="opt-hint">' + h("review.changeHint") + "</span></span></label>" +
    '<label class="field" for="corrections">' + h("review.corrections") + '</label><textarea id="corrections" name="corrections"></textarea>' +
    '<div class="actions"><button type="submit" class="btn primary">' + h("review.submit") + '</button><span class="status" role="status"></span></div>' +
    "</form>";
  const form = document.getElementById("review-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const verdict = form.verdict.value;
    const corrections = form.corrections.value.trim();
    if (verdict === "changes" && !corrections) {
      form.querySelector(".status").textContent = t("review.missing");
      return;
    }
    sendToAgent({
      form, tag: "brainstorm-review",
      summary: verdict === "approved" ? t("review.summaryApproved") : t("review.summaryChanges"),
      buildText: () => promptHeader("review: " + (verdict === "approved" ? "approved" : "changes requested")) +
        (corrections ? "\n" + t("review.textCorrections", { text: corrections }) : ""),
    });
  });
}

function renderDone() {
  main.innerHTML = agentNoteCard() +
    '<div class="card"><h2>' + h("done.title") + '</h2><p class="lead">' + h("done.lead", { folder: folderLabel() }) + "</p></div>" +
    renderDeliverableArticles();
}

// What the user has typed or checked, by field name, so a language switch
// re-renders the view without losing it.
function snapshotForm() {
  const form = main.querySelector("form");
  if (!form) return null;
  const fields = [];
  for (const element of form.elements) {
    if (!element.name || element.type === "file") continue;
    fields.push({ name: element.name, value: element.value, checked: element.checked, isCheckable: element.type === "checkbox" || element.type === "radio" });
  }
  const openDetails = [...form.querySelectorAll("details")].map((details) => details.open);
  return { fields, openDetails };
}

function restoreForm(snapshot) {
  const form = main.querySelector("form");
  if (!form || !snapshot) return;
  for (const field of snapshot.fields) {
    const candidates = [...form.elements].filter((element) => element.name === field.name);
    const target = field.isCheckable ? candidates.find((element) => element.value === field.value) : candidates[0];
    if (!target) continue;
    if (field.isCheckable) target.checked = field.checked;
    else target.value = field.value;
  }
  form.querySelectorAll("details").forEach((details, index) => {
    if (snapshot.openDetails[index]) details.open = true;
  });
}

function renderView() {
  applyStaticStrings();
  renderStepper();
  renderPanel();
  const isWaiting = data.phase !== "done" && readSentFlag();
  if (isWaiting) {
    main.innerHTML = agentNoteCard() + waitingCard();
    return;
  }
  const views = { intake: renderIntake, questions: renderQuestions, proposal: renderProposal, review: renderReview, done: renderDone };
  views[data.phase]();
}

function switchLanguage(choice) {
  const snapshot = snapshotForm();
  language.set(choice);
  renderLanguageSelect(switchLanguage);
  renderView();
  restoreForm(snapshot);
}

function boot() {
  // A file dropped outside the zone must not make the browser leave the page.
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());
  renderLanguageSelect(switchLanguage);
  renderView();
}

boot();
