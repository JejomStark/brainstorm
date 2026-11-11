# Schema of `brainstorm.json`

Keys in English, content in the session language (`lang`). `render` rejects an invalid file and names each faulty field: fix it and run it again. Texts marked *md* accept inline Markdown (`**bold**`, `*italic*`, `` `code` ``); `agentNote`, `questions[].body` and `deliverables.written[].content` accept full Markdown.

```json
{
  "version": 1,
  "title": "Reading tracker",
  "lang": "en",
  "langSource": "flag",
  "phase": "questions",
  "folder": "/absolute/path/of/the/session",
  "folderLabel": ".brainstorm/2026-10-31-120000",
  "createdAt": "2026-10-31T12:00:00.000Z",
  "profile": "product",
  "round": 2,
  "agentNote": "I read your three files. This round fixes the MVP scope.",
  "summary": "A local tool to log the books I read and find my quotes again.",
  "attachments": [
    { "name": "constraints.pdf", "path": "attachments/constraints.pdf", "note": "Constraints: local, free, Linux." }
  ],
  "state": {
    "decided": ["Personal use, a single user."],
    "unclear": ["Expected export format."],
    "assumptions": ["No sync between machines."],
    "glossary": [{ "term": "Card", "definition": "What is noted about a book once read." }],
    "risks": ["Abandoned if logging a book takes more than a minute."]
  },
  "questions": [
    {
      "id": "Q4",
      "title": "Where does the data live?",
      "body": "You wrote \"on my computer\".",
      "why": "Decides the storage format and the export.",
      "kind": "single",
      "options": [
        { "value": "markdown", "label": "One Markdown file per book", "hint": "readable anywhere, versionable" },
        { "value": "sqlite", "label": "A SQLite database" }
      ],
      "recommended": "markdown"
    }
  ],
  "deliverables": {
    "proposed": [{ "kind": "spec", "label": "Spec", "reason": "A tool to build.", "recommended": true }],
    "written": [{ "kind": "spec", "title": "Spec: reading tracker", "path": "deliverables/spec.md", "content": "# Spec…" }]
  },
  "history": [
    { "round": 1, "items": [{ "id": "Q1", "question": "Who is it for?", "answer": "Just me" }] }
  ]
}
```

## Fields

- `title`: name of the session, shown at the top of the page; empty shows a default title.
- `lang`: session language, one of the codes listed by `brainstorm.mjs languages` (`en`, `fr`). The page interface follows it, and so must every text you write.
- `langSource`: how `lang` was chosen: `flag` (`--lang`), `detected` (from the user's message), `page` (selector in the page, or asked in words), `default` (nothing given: English).
- `phase`: `intake` (request input), `questions`, `proposal`, `review`, `done`. The page shows the view of the phase.
- `round`: number of the round shown; increment it at each new round.
- `folder`: absolute path of the session, set by `init`. `folderLabel`: the same path as shown in the page (relative to the project when possible), for the manual drop of files too large for the page.
- `profile`: `product`, `technical`, `content` or `null`.
- `agentNote` (md): your message at the top of the page for this round. Short.
- `summary` (md): the need rephrased, rewritten at each round.
- `attachments[]`: `name`, `path` (relative to the folder; an image shows as a thumbnail), `note` (md).
- `state`: the "brainstorm state" panel, always visible.
  - `decided` (md): each entry is a decision taken, worded as such.
  - `unclear` (md): what is still open. Empty = no frontier left.
  - `assumptions` (md): what you assumed without asking.
  - `glossary`: `{ term, definition }`, one or two sentences per term.
  - `risks` (md).
- `questions[]`: in phase `questions`, 1 to 6 entries (3 to 5 aimed for), elsewhere `[]`.
  - `id` unique in the round (`Q1`, `Q2`… numbered across the whole session), `title`, `body` (md, optional), `why` (md, optional).
  - `kind`: `single` (radio buttons), `multiple` (checkboxes), `text` (free field).
  - `options[]` for `single` and `multiple`: at least 2 `{ value, label, hint? }`. The page always adds "Other answer" and a free detail.
  - `recommended`: your recommendation, preselected in the page. One `value` for `single`, an array of `value`s for `multiple`, a prefilled text for `text`.
- `deliverables.proposed[]`: `{ kind, label?, reason, recommended }`, required and non-empty in phase `proposal`.
- `deliverables.written[]`: `{ kind, title, path, content }`, required and non-empty in phase `review`.
- `history[]`: `{ round, items: [{ id, question, answer }] }`, one entry per answered round; the page shows them collapsed.

## What the page sends back

Each submission is **a single prompt** whose first line is a fixed English tag followed by the language: `[brainstorm] <tag> · lang=<code>`, plus ` (chosen in page)` when the user picked the language in the page. The rest is written in the page language.

- `[brainstorm] intake`: preferred profile, expected deliverable, need, list of files with their fate (sent, reduced then sent, or too large for the page: to copy into `<folder>/attachments/`).
- `[brainstorm] answers · round N`: per question, `→ answer`, the "recommendation accepted" mark when relevant, an optional detail; then the free remark and the added files.
- `[brainstorm] deliverables`: the list to write, and what is still to clarify if the user wants to resume the questions.
- `[brainstorm] review: approved` or `review: changes requested` with the changes.
