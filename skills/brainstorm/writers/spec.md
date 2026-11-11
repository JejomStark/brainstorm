# Writer: spec

File: `deliverables/spec.md`. A spec says **what** and **why**, precisely enough to build and verify, without dictating the **how** unless a constraint was decided.

```md
# Spec: <name>

## Context
<the problem and for whom, 3 to 5 lines, taken from `summary` and the attachments>

## Goal
<the expected result, measurable if possible>

## Scope
- In scope: …
- Out of scope: …

## Expected behaviour
<main journey then edge cases; one requirement per bullet, verifiable>

## Constraints
<the decisions that bound the solution>

## Acceptance criteria
- [ ] <one observable criterion per bullet>

## Assumptions and open questions
<what is still assumed; empty if everything was confirmed>

## Glossary
<the terms of `state.glossary`, if any>
```

Each entry of `state.decided` appears somewhere in the spec; each entry of `assumptions` appears under "Assumptions". Write it in the session language, headings included.
