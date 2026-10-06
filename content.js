(() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let active = false;
  let tooltip = null;
  let highlight = null;
  let lastTarget = null;
  let config = { language: "javascript", framework: "cypress" };

  // ── Selector engine ────────────────────────────────────────────────────────

  // Returns true if selector matches exactly one element on the page
  function isUnique(sel) {
    try { return document.querySelectorAll(sel).length === 1; } catch { return false; }
  }

  // Detect auto-generated IDs (React, Angular, random hashes, numeric-only)
  function isAutoId(id) {
    return /^(react-|ng-|ember|__)[\w-]+$|^\d+$|[a-f0-9]{6,}$/i.test(id);
  }

  // Depth of element from body — deeply nested = more fragile
  function getDepth(el) {
    let d = 0, cur = el;
    while (cur && cur !== document.body) { d++; cur = cur.parentElement; }
    return d;
  }

  // Stable visible text for button/link — short, no whitespace noise
  function getStableText(el) {
    const tag = el.tagName.toLowerCase();
    if (!["button", "a", "label", "h1","h2","h3","h4","h5","h6"].includes(tag)) return null;
    const t = el.textContent?.trim().replace(/\s+/g, " ");
    return t && t.length <= 40 && t.length >= 2 ? t : null;
  }

  // Build all candidate selectors with metadata
  function getCandidates(el) {
    const tag = el.tagName.toLowerCase();
    const candidates = [];

    const push = (sel, grade, reason) => {
      if (!sel) return;
      const unique = isUnique(sel);
      candidates.push({ sel, grade: unique ? grade : Math.min(grade, 2), reason, unique });
    };

    // Grade 4 — dedicated test attributes (best possible)
    push(el.getAttribute("data-testid") && `[data-testid="${el.getAttribute("data-testid")}"]`, 4, "data-testid — purpose-built for testing");
    push(el.getAttribute("data-cy")     && `[data-cy="${el.getAttribute("data-cy")}"]`,         4, "data-cy — Cypress test attribute");
    push(el.getAttribute("data-test")   && `[data-test="${el.getAttribute("data-test")}"]`,     4, "data-test — test attribute");
    push(el.getAttribute("data-qa")     && `[data-qa="${el.getAttribute("data-qa")}"]`,         4, "data-qa — QA test attribute");
    push(el.getAttribute("data-e2e")    && `[data-e2e="${el.getAttribute("data-e2e")}"]`,       4, "data-e2e — end-to-end test attribute");

    // Grade 3 — stable semantic attributes
    const id = el.id;
    if (id && !isAutoId(id)) push(`#${CSS.escape(id)}`, 3, "ID — unique and stable");
    if (id &&  isAutoId(id)) push(`#${CSS.escape(id)}`, 1, "ID looks auto-generated — may change on rebuild");

    push(el.getAttribute("aria-label")     && `[aria-label="${el.getAttribute("aria-label")}"]`,         3, "aria-label — accessible and stable");
    push(el.getAttribute("aria-labelledby")&& `[aria-labelledby="${el.getAttribute("aria-labelledby")}"]`,3, "aria-labelledby — accessible reference");
    push(el.getAttribute("name")           && `[name="${el.getAttribute("name")}"]`,                     3, "name attribute — stable form field selector");
    push(el.getAttribute("for")            && `[for="${el.getAttribute("for")}"]`,                       3, "for attribute — label association");

    // Grade 2 — contextual but reasonable
    push(el.getAttribute("role")        && `[role="${el.getAttribute("role")}"]`,               2, "role — semantic but not unique");
    push(el.getAttribute("placeholder") && `[placeholder="${el.getAttribute("placeholder")}"]`, 2, "placeholder — may change with copy updates");
    push(el.getAttribute("type") && tag === "input" && `input[type="${el.getAttribute("type")}"]`, 2, "input type — not unique on its own");
    push(el.getAttribute("href") && tag === "a"     && `a[href="${el.getAttribute("href")}"]`,    2, "href — fragile if URL changes");
    push(el.getAttribute("alt")  && tag === "img"   && `img[alt="${el.getAttribute("alt")}"]`,    2, "alt text — reasonable for images");
    push(el.getAttribute("title")&& `[title="${el.getAttribute("title")}"]`,                     2, "title attribute");

    const text = getStableText(el);
    if (text) push(`${tag}:contains("${text}")`, 2, "visible text — readable but brittle if copy changes");

    // Grade 1 — class-based (fragile)
    const classes = [...el.classList].filter(c => !/^(ng-|js-|is-|has-|active|disabled|focus|hover|selected|open|show|hide|visible|invisible|d-|col-|row-|flex-|grid-|p-|m-|text-|bg-|border-|rounded|w-|h-)/.test(c));
    if (classes.length) {
      const sel = `${tag}.${classes.slice(0,2).map(CSS.escape).join(".")}`;
      push(sel, 1, "class selector — breaks when styles are refactored");
    }

    // Grade 0 — last resort
    push(tag, 0, "tag only — extremely fragile");

    // Sort by grade desc, unique first
    candidates.sort((a, b) => b.grade - a.grade || (b.unique ? 1 : 0) - (a.unique ? 1 : 0));
    return candidates;
  }

  const GRADES = [
    { label: "Poor",      color: "#ef4444", bg: "#450a0a", bar: 1, icon: "✗" },
    { label: "Weak",      color: "#f97316", bg: "#431407", bar: 2, icon: "△" },
    { label: "Fair",      color: "#f59e0b", bg: "#451a03", bar: 3, icon: "◎" },
    { label: "Good",      color: "#3b82f6", bg: "#172554", bar: 4, icon: "●" },
    { label: "Excellent", color: "#22c55e", bg: "#052e16", bar: 5, icon: "★" },
  ];

  function getBestSelector(el) {
    return getCandidates(el)[0]?.sel || el.tagName.toLowerCase();
  }

  function getSelectorInfo(el) {
    const candidates = getCandidates(el);
    const best = candidates[0] || { sel: el.tagName.toLowerCase(), grade: 0, reason: "tag only", unique: false };
    const grade = GRADES[Math.min(best.grade, 4)];
    return { best, candidates, grade };
  }

  // ── Code generation ────────────────────────────────────────────────────────
  const TEMPLATES = {
    cypress: {
      javascript: sel => `cy.get('${sel}')`,
      typescript: sel => `cy.get('${sel}')`,
    },
    playwright: {
      javascript: sel => `await page.locator('${sel}')`,
      typescript: sel => `await page.locator('${sel}')`,
      python:     sel => `page.locator('${sel}')`,
      java:       sel => `page.locator("${sel}")`,
      csharp:     sel => `page.Locator("${sel}")`,
    },
    pytest: {
      python: sel => `driver.find_element(By.CSS_SELECTOR, '${sel}')`,
    },
    selenium: {
      javascript: sel => `driver.findElement(By.css('${sel}'))`,
      typescript: sel => `driver.findElement(By.css('${sel}'))`,
      python:     sel => `driver.find_element(By.CSS_SELECTOR, '${sel}')`,
      java:       sel => `driver.findElement(By.cssSelector("${sel}"))`,
      csharp:     sel => `driver.FindElement(By.CssSelector("${sel}"))`,
      ruby:       sel => `find('${sel}')`,
    },
    testcafe: {
      javascript: sel => `Selector('${sel}')`,
      typescript: sel => `Selector('${sel}')`,
    },
    webdriverio: {
      javascript: sel => `await $('${sel}')`,
      typescript: sel => `await $('${sel}')`,
    },
    puppeteer: {
      javascript: sel => `await page.$('${sel}')`,
      typescript: sel => `await page.$('${sel}')`,
    },
  };

  function generateCode(selector, framework, language) {
    const fw = TEMPLATES[framework] || TEMPLATES.cypress;
    const fn = fw[language] || fw.javascript || Object.values(fw)[0];
    return fn(selector);
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  function createTooltip() {
    tooltip = document.createElement("div");
    tooltip.id = "__qa-inspector-tooltip__";
    document.body.appendChild(tooltip);
  }

  function createHighlight() {
    highlight = document.createElement("div");
    highlight.id = "__qa-inspector-highlight__";
    highlight.style.display = "block";
    document.body.appendChild(highlight);
  }

  function positionHighlight(el) {
    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      top:    `${r.top + window.scrollY}px`,
      left:   `${r.left + window.scrollX}px`,
      width:  `${r.width}px`,
      height: `${r.height}px`,
    });
  }

  function positionTooltip(e) {
    const pad = 12;
    let top  = e.clientY + window.scrollY + pad;
    let left = e.clientX + window.scrollX + pad;
    const tw = tooltip.offsetWidth  || 320;
    const th = tooltip.offsetHeight || 120;
    if (left + tw > window.innerWidth  - 10) left = e.clientX + window.scrollX - tw - pad;
    if (top  + th > window.innerHeight + window.scrollY - 10) top = e.clientY + window.scrollY - th - pad;
    Object.assign(tooltip.style, { top: `${top}px`, left: `${left}px` });
  }

  function renderTooltip(el, e) {
    const { best, candidates, grade } = getSelectorInfo(el);
    const code = generateCode(best.sel, config.framework, config.language);
    const tag  = el.tagName.toLowerCase();
    const text = el.textContent?.trim().slice(0, 40) || "";

    // Score bar segments (5 blocks)
    const bars = Array.from({ length: 5 }, (_, i) =>
      `<span class="qai-bar ${i < grade.bar ? "qai-bar-fill" : ""}" style="${i < grade.bar ? `background:${grade.color}` : ""}"></span>`
    ).join("");

    // Alternatives — top 3 other candidates excluding the best
    const alts = candidates.slice(1, 4);
    const altsHtml = alts.length ? `
      <div class="qai-alts-label">Alternatives</div>
      ${alts.map(c => {
        const g = GRADES[Math.min(c.grade, 4)];
        return `<div class="qai-alt">
          <span class="qai-alt-dot" style="background:${g.color}"></span>
          <span class="qai-alt-sel">${escapeHtml(c.sel)}</span>
          <span class="qai-alt-grade" style="color:${g.color}">${g.label}</span>
        </div>`;
      }).join("")}
    ` : "";

    tooltip.innerHTML = `
      <div class="qai-score-banner" style="background:${grade.bg};border-color:${grade.color}">
        <span class="qai-score-icon" style="color:${grade.color}">${grade.icon}</span>
        <div class="qai-score-info">
          <span class="qai-score-label" style="color:${grade.color}">${grade.label}</span>
          <span class="qai-score-reason">${best.reason}</span>
        </div>
        <div class="qai-bars">${bars}</div>
      </div>
      <div class="qai-section-label">ELEMENT</div>
      <div class="qai-element-row">
        <span class="qai-tag">&lt;${tag}&gt;</span>
        ${best.unique
          ? `<span class="qai-unique">&#10003; unique</span>`
          : `<span class="qai-not-unique">&#9888; not unique</span>`}
        ${text ? `<span class="qai-eltext">&ldquo;${escapeHtml(text.slice(0,28))}${text.length>28?"&hellip;":""}&rdquo;</span>` : ""}
      </div>
      <div class="qai-section-label">BEST SELECTOR</div>
      <div class="qai-selector">${escapeHtml(best.sel)}</div>
      <div class="qai-section-label">${config.framework.toUpperCase()} &middot; ${config.language.toUpperCase()}</div>
      <div class="qai-code">${escapeHtml(code)}</div>
      ${altsHtml}
      <div class="qai-hint">Click to copy code &nbsp;&middot;&nbsp; Alt+click for XPath</div>
    `;
    tooltip.style.display = "block";
    positionTooltip(e);
  }

  function escapeHtml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── XPath fallback ─────────────────────────────────────────────────────────
  function getXPath(el) {
    if (el.id) return `//*[@id="${el.id}"]`;
    const parts = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let idx = 1;
      let sib = el.previousSibling;
      while (sib) { if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === el.tagName) idx++; sib = sib.previousSibling; }
      parts.unshift(`${el.tagName.toLowerCase()}[${idx}]`);
      el = el.parentNode;
    }
    return `/${parts.join("/")}`;
  }

  // ── Event handlers ─────────────────────────────────────────────────────────
  function onMouseOver(e) {
    if (!active || e.target === tooltip || tooltip?.contains(e.target)) return;
    lastTarget = e.target;
    positionHighlight(e.target);
    renderTooltip(e.target, e);
  }

  function onMouseMove(e) {
    if (!active || !tooltip || tooltip.style.display === "none") return;
    positionTooltip(e);
  }

  function onMouseOut(e) {
    if (!active) return;
    // Only hide when leaving the document entirely
    if (!e.relatedTarget) tooltip && (tooltip.style.display = "none");
  }

  function onClick(e) {
    if (!active || !lastTarget) return;
    e.preventDefault();
    e.stopPropagation();
    const sel  = e.altKey ? getXPath(lastTarget) : getBestSelector(lastTarget);
    const code = e.altKey ? sel : generateCode(sel, config.framework, config.language);
    navigator.clipboard.writeText(code).then(() => showCopied());
  }

  function showCopied() {
    const prev = tooltip.querySelector(".qai-hint");
    if (prev) { prev.textContent = "✓ Copied!"; prev.style.color = "#22c55e"; }
    setTimeout(() => { if (prev) { prev.textContent = "Click to copy • Alt+click for XPath"; prev.style.color = ""; } }, 1500);
  }

  // ── Activation ─────────────────────────────────────────────────────────────
  function activate() {
    if (!tooltip)   createTooltip();
    if (!highlight) createHighlight();
    active = true;
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseout",  onMouseOut,  true);
    document.addEventListener("click",     onClick,     true);
    document.body.classList.add("__qa-inspector-active__");
  }

  function deactivate() {
    active = false;
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("mouseout",  onMouseOut,  true);
    document.removeEventListener("click",     onClick,     true);
    document.body.classList.remove("__qa-inspector-active__");
    if (tooltip)    tooltip.style.display    = "none";
    if (highlight)  highlight.style.display  = "none";
  }

  // ── Message bridge ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE")    { msg.active ? activate() : deactivate(); }
    if (msg.type === "CONFIG")    { config = { ...config, ...msg.config }; }
    if (msg.type === "GET_STATE") { chrome.runtime.sendMessage({ type: "STATE", active }); }
  });

  // Restore config on load
  chrome.storage.sync.get(["language", "framework", "inspectorActive"], (data) => {
    if (data.language)  config.language  = data.language;
    if (data.framework) config.framework = data.framework;
    if (data.inspectorActive) activate();
  });
})();
