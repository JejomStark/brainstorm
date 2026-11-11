# Attachment reader

`wait` has already saved each file into `attachments/` and listed its path under "attachments saved". For a short text, its content follows in the output, between `----- content of … -----` and `----- end of … -----`.

1. **Read each file.** Short text: already in front of you. Long text, PDF, image: the `Read` tool on `<folder>/attachments/<file>` (it reads PDFs by pages and sees images). An image reduced by the page (name ending in `-reduced.jpg` or `-reduite.jpg`) is enough to understand a screenshot; if an unreadable detail matters, ask for the original as a manual drop.
2. **File too large.** The request reports it as too large for the page, to copy into `<folder>/attachments/`. Say so in `agentNote`, and at the next round check whether the file arrived in `attachments/`.
3. **Note what it brings.** Add to `attachments` an entry `{ name, path, note }`: the note says in one line, in the session language, what the file changes in the brainstorm (constraint, example, decision already taken).
4. **Put it to work.** What a file establishes goes into `decided` or `assumptions` (with the file as source); what it contradicts in the request becomes a question.

A file that arrives along the way (form of a round) follows the same path.
