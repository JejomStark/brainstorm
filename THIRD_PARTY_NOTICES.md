# Third-party notices

brainstorm builds on the work of two MIT-licensed projects. No source code from
them is copied into this repository; what is reused is listed below, with the
license notice each project requires.

## mattpocock/skills

- Project: https://github.com/mattpocock/skills
- Author: Matt Pocock
- License: MIT
- Reused in brainstorm:
  - the round-by-round questioning method of the **grilling** skill
    (`skills/productivity/grilling`): the decision tree, the frontier of
    questions that can be asked now, facts looked up rather than asked, a
    recommendation for every question. Adapted in
    `skills/brainstorm/blocks/questioner.md`.
  - the **ADR** and **CONTEXT.md** (glossary) formats of the
    **domain-modeling** skill (`skills/engineering/domain-modeling`). Adapted in
    `skills/brainstorm/writers/adr.md` and `skills/brainstorm/writers/context.md`.

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Lavish (lavish-axi)

- Project: https://github.com/kunchenguid/lavish-axi
- Package: https://www.npmjs.com/package/lavish-axi
- Author: Kun Chen (kunchenguid)
- License: MIT
- Used by brainstorm: Lavish is a runtime dependency installed separately
  (`npm install -g lavish-axi`). brainstorm drives its CLI (`lavish-axi`,
  `poll`, `reply`) and uses its documented in-page API (`window.lavish.queuePrompt`,
  `window.lavish.sendQueuedPrompts`, `data-lavish-question`,
  `data-lavish-annotate`). Lavish itself is not bundled.

```
MIT License

Copyright (c) 2026 Kun Chen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
