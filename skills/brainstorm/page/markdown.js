// Minimal Markdown rendering to review the deliverables in the page, with no dependency.
// Covers headings, paragraphs, lists, quotes, code blocks, tables and emphasis.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text) {
  const codeSpans = [];
  const withoutCode = text.replace(/`([^`]+)`/g, (_match, code) => {
    codeSpans.push("<code>" + escapeHtml(code) + "</code>");
    return "\u0000" + (codeSpans.length - 1) + "\u0000";
  });
  return escapeHtml(withoutCode)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/\u0000(\d+)\u0000/g, (_match, index) => codeSpans[Number(index)]);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderTable(lines) {
  const [headerLine, , ...bodyLines] = lines;
  const head = splitTableRow(headerLine).map((cell) => "<th>" + renderInline(cell) + "</th>").join("");
  const body = bodyLines
    .map((line) => "<tr>" + splitTableRow(line).map((cell) => "<td>" + renderInline(cell) + "</td>").join("") + "</tr>")
    .join("");
  return "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
}

function renderList(lines) {
  const isOrdered = /^\s*\d+[.)]\s/.test(lines[0]);
  const items = lines.map((line) => "<li>" + renderInline(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")) + "</li>").join("");
  return isOrdered ? "<ol>" + items + "</ol>" : "<ul>" + items + "</ul>";
}

// Collects the consecutive lines that match the predicate, from `start`.
function takeWhile(lines, start, predicate) {
  const taken = [];
  let index = start;
  while (index < lines.length && predicate(lines[index])) {
    taken.push(lines[index]);
    index++;
  }
  return { taken, next: index };
}

const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const PARAGRAPH_BREAK_RE = /^(#{1,6}\s|```|~~~|\s*[-*+]\s|\s*\d+[.)]\s|>|\s*\|)/;

// Renders the block starting at `index` and returns the index of the next line.
// Test order matters: a code block is recognised before anything else.
function renderBlockAt(lines, index) {
  const line = lines[index];
  const fence = line.match(/^(```|~~~)/);
  if (fence) {
    const block = takeWhile(lines, index + 1, (candidate) => !candidate.startsWith(fence[1]));
    return { html: "<pre><code>" + escapeHtml(block.taken.join("\n")) + "</code></pre>", next: block.next + 1 };
  }
  const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (heading) {
    const level = heading[1].length;
    return { html: "<h" + level + ">" + renderInline(heading[2]) + "</h" + level + ">", next: index + 1 };
  }
  if (/^\s*(---|\*\*\*)\s*$/.test(line)) return { html: "<hr>", next: index + 1 };
  if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] || "")) {
    const table = takeWhile(lines, index, (candidate) => /^\s*\|/.test(candidate));
    return { html: renderTable(table.taken), next: table.next };
  }
  if (LIST_ITEM_RE.test(line)) {
    const list = takeWhile(lines, index, (candidate) => LIST_ITEM_RE.test(candidate));
    return { html: renderList(list.taken), next: list.next };
  }
  if (/^>\s?/.test(line)) {
    const quote = takeWhile(lines, index, (candidate) => /^>\s?/.test(candidate));
    return { html: "<blockquote>" + renderInline(quote.taken.map((item) => item.replace(/^>\s?/, "")).join(" ")) + "</blockquote>", next: quote.next };
  }
  const paragraph = takeWhile(lines, index, (candidate) => !/^\s*$/.test(candidate) && !PARAGRAPH_BREAK_RE.test(candidate));
  if (!paragraph.taken.length) return { html: "<p>" + renderInline(line) + "</p>", next: index + 1 };
  return { html: "<p>" + renderInline(paragraph.taken.join(" ")) + "</p>", next: paragraph.next };
}

function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;
  while (index < lines.length) {
    if (/^\s*$/.test(lines[index])) {
      index++;
      continue;
    }
    const block = renderBlockAt(lines, index);
    html.push(block.html);
    index = block.next;
  }
  return html.join("\n");
}
