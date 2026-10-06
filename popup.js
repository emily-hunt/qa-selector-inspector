const toggle      = document.getElementById("toggleInspector");
const statusDot   = document.getElementById("statusDot");
const statusText  = document.getElementById("statusText");
const frameworkEl = document.getElementById("framework");
const languageEl  = document.getElementById("language");

function setStatus(active) {
  toggle.checked = active;
  statusDot.classList.toggle("active", active);
  statusText.textContent = active
    ? "Inspector active — hover any element"
    : "Inspector off — enable to start";
}

function saveConfig() {
  const config = { framework: frameworkEl.value, language: languageEl.value };
  chrome.storage.sync.set(config);
  // Send config directly to the active tab's content script
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "CONFIG", config }).catch(() => {});
  });
}

const FRAMEWORK_LANGS = {
  cypress:     ["javascript", "typescript"],
  playwright:  ["javascript", "typescript", "python", "java", "csharp"],
  pytest:      ["python"],
  selenium:    ["javascript", "typescript", "python", "java", "csharp", "ruby"],
  testcafe:    ["javascript", "typescript"],
  webdriverio: ["javascript", "typescript"],
  puppeteer:   ["javascript", "typescript"],
};

function updateLanguageOptions(framework, currentLang) {
  const supported = FRAMEWORK_LANGS[framework] || ["javascript", "typescript"];
  [...languageEl.options].forEach(opt => { opt.hidden = !supported.includes(opt.value); });
  if (!supported.includes(languageEl.value)) languageEl.value = supported[0];
  if (currentLang && supported.includes(currentLang)) languageEl.value = currentLang;
}

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.storage.sync.get(["language", "framework", "inspectorActive"], (data) => {
  const fw   = data.framework || "cypress";
  const lang = data.language  || "javascript";
  frameworkEl.value = fw;
  updateLanguageOptions(fw, lang);
  setStatus(!!data.inspectorActive);
});

// ── Toggle — send to background so it survives popup closing ─────────────────
toggle.addEventListener("change", () => {
  const active = toggle.checked;
  chrome.storage.sync.set({ inspectorActive: active });
  chrome.runtime.sendMessage({ type: "TOGGLE", active });
  setStatus(active);
});

frameworkEl.addEventListener("change", () => { updateLanguageOptions(frameworkEl.value, null); saveConfig(); });
languageEl.addEventListener("change", saveConfig);
