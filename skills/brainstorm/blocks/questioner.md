# Questioner

Block taken from *grilling* (Matt Pocock, MIT): question relentlessly until a shared understanding is reached, but in rounds in the page, with controls rather than free text.

## The tree and the frontier

The need maps to a **decision tree**: each decision opens the ones that depend on it. The chosen profile gives the starting branches.

The **frontier** is the set of decisions whose prerequisites are all settled: the ones that can be asked *now* without guessing an answer not heard yet. A round asks the frontier, at most 5 questions, the most structuring first. A question that depends on another question of the same round waits for the next round.

Each answer reshapes the tree: recompute the frontier before writing the next round.

## Writing a question

Write in the session language (`lang`).

- **One idea per question**, short title, worded as a question.
- `kind`: `single` when the options exclude each other, `multiple` when they add up, `text` only when no list fits (a name, a number, a sentence from the user). Always prefer a list: the user answers faster by checking than by writing.
- Always a **recommendation** (`recommended`), argued in a `hint` or in `why`. The page preselects it: the user only corrects.
- `why` when the question could look gratuitous: what the answer decides.
- `body` to quote what motivates the question: a sentence of the request, a line of an attachment.

## Facts and decisions

A fact can be found (repository, attachments, command, documentation): do not ask it, look it up, and note it in `decided` or `assumptions` with its source. A decision belongs to the user: ask it.

## Keeping the state panel

At each round, rewrite `state` entirely:

- `decided`: each answer becomes a worded decision ("Personal use, a single user"), not a quote of the question.
- `unclear`: each point still open. It is the frontier to come: what it holds must become a question of a later round or an assumed hypothesis.
- `assumptions`: what you assumed without asking. Have them confirmed at the next round when they weigh on the deliverable.
- `glossary`: a term as soon as it is fixed, a one- or two-sentence definition. When the user uses a vague word, or two words for the same thing, propose the canonical term as a question.
- `risks`: what can make the need fail.

Add the entry of the answered round to `history` (`question` = title, `answer` = summarised answer).

## End of the rounds

No more rounds when `unclear` holds nothing that blocks the deliverable. Do not stop earlier to go faster: one more round costs the user a minute, a deliverable built on a blur costs everything after it.
