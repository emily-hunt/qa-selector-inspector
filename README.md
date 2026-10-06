# QA Selector Inspector

A Chrome extension that answers the question every test author asks ten
times a day: **"what's the best selector for this element?"**

Hover over any element on any page and get an instantly graded selector —
`Excellent` to `Poor` — with the reason why, plus copy-paste-ready code
for your framework and language. Click to copy. Alt+click for XPath.

## Why this exists

Half of test flakiness starts before a single line of test code is
written — at selector choice. `div:nth-child(3) > .css-1a2b3c` passes
today and breaks on the next deploy. Everyone knows `data-testid` is
better, but in the moment — staring at DevTools, copying a class chain —
the resilient choice is the slow one, so nobody makes it.

This flips that: the tooltip grades every candidate selector on the
spot, explains the grade in plain language, and hands you the code.
Picking the stable selector becomes faster than picking the fragile one.

## How it grades

| Grade | Selector | Why |
|---|---|---|
| ★ Excellent | `data-testid`, `data-cy`, `data-test`, `data-qa`, `data-e2e` | Purpose-built for testing — survives redesigns |
| ● Good | stable `#id`, `aria-label`, `name`, `for` | Unique and semantic |
| ◎ Fair | `role`, `placeholder`, `alt`, visible text | Readable, but can change with copy |
| △ Weak | `.class` selectors | Breaks when styles are refactored |
| ✗ Poor | tag only | Extremely fragile |

Two things it checks that most selector tools don't:

- **Uniqueness** — every candidate is verified with `querySelectorAll`.
  A "good" selector that matches 14 elements gets flagged, not recommended.
- **Auto-generated IDs** — `react-`, `ng-`, hashes, numeric-only IDs are
  detected and downgraded. An ID that changes on rebuild is worse than no ID.

The tooltip shows the best pick plus the top 3 alternatives with their
grades, so you can trade off when the ideal attribute isn't there.

## Code generation

Pick your framework and language once in the popup; every hover shows
ready-to-paste code:

| Framework | Languages |
|---|---|
| Cypress | JS, TS |
| Playwright | JS, TS, Python, Java, C# |
| Selenium / WebDriver | JS, TS, Python, Java, C#, Ruby |
| PyTest | Python |
| TestCafe | JS, TS |
| WebdriverIO | JS, TS |
| Puppeteer | JS, TS |

## Install

1. Clone this repo.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the extension folder.
4. Click the toolbar icon, toggle the inspector on, hover anything.

Config (framework + language) syncs via `chrome.storage.sync`.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3, `activeTab` + `storage` permissions only |
| `content.js` | Selector engine (grading, uniqueness, auto-ID detection), tooltip UI, code generation, click-to-copy / Alt+click-XPath |
| `content.css` | Tooltip + highlight styles |
| `popup.html` / `popup.js` / `popup.css` | Toolbar popup: toggle, framework/language config, priority legend |
| `background.js` | Relays the toggle message to the active tab |
| `demo.html` | Local demo page for trying it out |
