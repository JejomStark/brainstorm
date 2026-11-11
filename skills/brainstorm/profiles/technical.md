# Technical profile

A need about architecture, tooling, migration or integration.

## Branches of the tree

1. **Starting point**: what exists (read it in the repository before asking), what breaks or is missing.
2. **Goal**: the expected behaviour, measurable if possible (latency, cost, build time).
3. **Options**: at least two real paths, with their costs and what they lock in.
4. **Constraints**: compatibility, data to migrate, security, reversibility, intervention window.
5. **Boundaries**: modules touched, interfaces that change, what must not move.
6. **Validation**: how to prove it is done (tests, measurement, demonstration).
7. **Rollback**: how to go back if it goes wrong.

## Default deliverables

`adr` recommended when one option wins over another after a trade-off; `spec` for the expected behaviour; `plan` for a migration in steps; `brief` if an agent executes.
