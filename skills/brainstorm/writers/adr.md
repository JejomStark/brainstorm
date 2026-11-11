# Writer: ADR

Format from *domain-modeling* (Matt Pocock, MIT). File: `deliverables/adr-NNNN-<slug>.md`; if the session is about a repository that already has `docs/adr/`, continue its numbering (highest number + 1) and offer to copy it there.

An ADR is justified only if the decision is **at once** hard to reverse, surprising without context, and the result of a real trade-off. Otherwise, say so and propose a spec.

```md
# <Short title of the decision>

<1 to 3 sentences: the context, what was decided, why.>
```

Optional sections, only when they add something: status in frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`), **Considered options** (when the rejection is not obvious), **Consequences** (when they do not show).

Write it in the session language, headings included.
