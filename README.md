# Hi, I'm Emily 👋

SDET. I build tools that make test suites trustworthy — the kind of tooling
that turns "CI is red again, just re-run it" into a five-minute triage.

## What I build

| Project | Story |
|---|---|
| [**visual-review**](https://github.com/qa-solutions/visual-review) | Our visual tests cried wolf: a 1pt font bump failed the build, and the team learned to ignore red. So I built a screenshot comparator with a third verdict — *needs review* — between pass and fail. Published on npm, running in Jenkins. |
| [**qa-selector-inspector**](https://github.com/qa-solutions/qa-selector-inspector) | Half of test flakiness starts at the selector: `div:nth-child(3) > .css-1a2b3c` breaks on the next deploy. A Chrome extension that grades every selector on the page from Excellent to Poor and generates copy-paste code for 7 frameworks — so the resilient choice is also the easy one. |

## Talks

- *Taming Flaky Snapshots* — Knowledge Sharing, Oct 2026. Proposing visual-review as our Cypress + Playwright snapshot tool: the needs-review verdict, the one-click accept UI, and the codemod migration path.

## Currently exploring

Test platform engineering: quarantining, flake analytics, and CI that stays green without hiding real regressions.

---

*The best test suite is the one the team still trusts on a Friday afternoon.*
