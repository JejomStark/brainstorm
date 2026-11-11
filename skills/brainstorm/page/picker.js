// Attachment picker: a real native <input type="file" multiple> (Lavish leaves it
// interactive and does not capture it as an annotation) inside a <label> that is
// also the drag-and-drop zone.
//
// Transport: each file travels in base64 inside the prompt text, tagged
//   [[brainstorm-file:<encoded name>:<type>:<size>:<base64>]]
// then `brainstorm.mjs wait` saves it into <folder>/attachments/.
// The Lavish server rejects a submission whose JSON body exceeds 2 MB: we keep
// a margin under that ceiling for all the files of one submission.

const INLINE_BUDGET_CHARS = 1400000;
const IMAGE_MAX_EDGE = 1600;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"];

// Files chosen in each picker, kept outside the DOM so a language switch
// (which re-renders the view) does not lose them.
const pickerStores = {};

function readAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error || new Error(t("picker.readError")));
    reader.readAsDataURL(blob);
  });
}

function base64Length(size) {
  return Math.ceil(size / 3) * 4;
}

// Reduces an image too heavy for the submission: JPEG, longest edge IMAGE_MAX_EDGE.
async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error(t("picker.shrinkError"));
  const name = file.name.replace(/\.[^.]+$/, "") + t("picker.shrunkSuffix") + ".jpg";
  return { blob, name, type: "image/jpeg" };
}

/**
 * Prepares the files of one submission. Returns the markers to append to the
 * prompt and a report per file; a file that does not fit in the budget is
 * reported "to add by hand" instead of being truncated.
 */
async function encodeAttachments(files) {
  let remaining = INLINE_BUDGET_CHARS;
  const markers = [];
  const report = [];
  for (const file of files) {
    let payload = { blob: file, name: file.name, type: file.type || "application/octet-stream" };
    let note = t("picker.sent");
    if (base64Length(file.size) > remaining && IMAGE_TYPES.includes(file.type)) {
      payload = await shrinkImage(file);
      note = t("picker.shrunk", { from: formatBytes(file.size), to: formatBytes(payload.blob.size) });
    }
    if (base64Length(payload.blob.size) > remaining) {
      report.push({ name: file.name, size: file.size, type: file.type, sent: false, note: t("picker.tooLargeNote") });
      continue;
    }
    const base64 = await readAsBase64(payload.blob);
    remaining -= base64.length;
    markers.push("[[brainstorm-file:" + encodeURIComponent(payload.name) + ":" + payload.type + ":" + payload.blob.size + ":" + base64 + "]]");
    report.push({ name: payload.name, size: payload.blob.size, type: payload.type, sent: true, note });
  }
  return { markers, report };
}

// One line per file, with its expected fate at submission given the cumulated budget.
function fileItemsHtml(files) {
  let projected = 0;
  return files.map((file, index) => {
    projected += base64Length(file.size);
    const fits = projected <= INLINE_BUDGET_CHARS;
    const isImage = IMAGE_TYPES.includes(file.type);
    let badge = '<span class="badge ok">' + h("picker.ready") + "</span>";
    if (!fits && isImage) badge = '<span class="badge warn">' + h("picker.willShrink") + "</span>";
    if (!fits && !isImage) badge = '<span class="badge risk">' + h("picker.tooLarge") + "</span>";
    return '<li class="file-item"><span class="file-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + "</span>" +
      '<span class="file-meta">' + escapeHtml(formatBytes(file.size)) + "</span>" + badge +
      '<button type="button" class="btn small" data-remove="' + index + '" aria-label="' + escapeHtml(t("picker.removeLabel", { name: file.name })) + '">' +
      h("picker.remove") + "</button></li>";
  }).join("");
}

function bindDropZone(drop, onFiles) {
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("is-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("is-over");
    if (event.dataTransfer && event.dataTransfer.files.length) onFiles(event.dataTransfer.files);
  });
}

/**
 * Mounts a picker in `container` and returns { files() }. `key` names the
 * store that keeps the chosen files across re-renders of the view.
 * The budget is checked on add, to warn the user before the submission.
 */
function createAttachmentPicker(container, key) {
  const inputId = "files-" + key;
  const files = pickerStores[key] || (pickerStores[key] = []);
  container.innerHTML =
    '<label class="drop" for="' + inputId + '">' +
    '<span class="drop-title">' + h("picker.title") + "</span>" +
    '<span class="drop-sub">' + h("picker.sub") + "</span>" +
    '<input type="file" id="' + inputId + '" multiple aria-label="' + escapeHtml(t("picker.inputLabel")) + '">' +
    "</label>" +
    '<ul class="file-list" aria-live="polite"></ul>';
  const input = container.querySelector("input[type=file]");
  const list = container.querySelector(".file-list");
  const render = () => { list.innerHTML = fileItemsHtml(files); };

  function addFiles(fileList) {
    for (const file of fileList) {
      const isDuplicate = files.some((known) => known.name === file.name && known.size === file.size && known.lastModified === file.lastModified);
      if (!isDuplicate) files.push(file);
    }
    render();
  }

  input.addEventListener("change", () => {
    addFiles(input.files);
    // Clearing the value lets the user pick the same file again after removing it.
    input.value = "";
  });
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    files.splice(Number(button.getAttribute("data-remove")), 1);
    render();
  });
  bindDropZone(container.querySelector(".drop"), addFiles);
  render();
  return { files: () => files.slice() };
}
