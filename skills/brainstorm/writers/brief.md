# Writer: agent brief

File: `deliverables/brief.md`. A brief is the **only** thing the agent will know: it carries all the useful context, and nothing else.

```md
# Brief: <name>

## Goal
<the expected result, in one sentence>

## Context
<what the agent must know and cannot find alone; point to files rather than copying them>

## Decisions taken
<the entries of `state.decided` useful for the execution>

## Scope
- To do: …
- Do not touch: …

## Done when
- <verifiable criterion, preferably by a command or an observation>

## If you get stuck
<who decides, what is allowed without asking>
```

Write the instructions in the positive (what to do); a prohibition only as a guardrail, with the expected conduct. Write it in the session language, headings included.
