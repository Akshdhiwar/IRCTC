// background.js

let armedConfig = null;
let armedTargetTime = null;
let checkInterval = null;

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ARM') {
    armedConfig     = msg.config;
    armedTargetTime = msg.targetTime;

    const delayMin = Math.max(0.1, (msg.targetTime - Date.now()) / 60000);
    chrome.alarms.clear('irctcFire', () => {
      chrome.alarms.create('irctcFire', { delayInMinutes: delayMin });
    });

    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
      if (Date.now() >= armedTargetTime) {
        clearInterval(checkInterval);
        checkInterval = null;
        fireTrigger();
      }
    }, 250);

    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'DISARM') {
    disarm();
    sendResponse({ ok: true });
    return true;
  }

  // Forward STATUS / DONE from injected script → popup
  if (msg.type === 'CONTENT_STATUS') {
    chrome.runtime.sendMessage({ type: 'STATUS', text: msg.text, dot: msg.dot }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'CONTENT_DONE') {
    chrome.runtime.sendMessage({ type: 'DONE', success: msg.success }).catch(() => {});
    disarm();
    sendResponse({ ok: true });
    return true;
  }
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'irctcFire' && !checkInterval) fireTrigger();
});

// ── Core ──────────────────────────────────────────────────────────────────────

function disarm() {
  armedConfig = null;
  armedTargetTime = null;
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  chrome.alarms.clear('irctcFire');
  chrome.storage.local.remove('irctcArmed');
}

async function fireTrigger() {
  chrome.runtime.sendMessage({ type: 'FIRED' }).catch(() => {});

  if (!armedConfig) {
    const data = await chrome.storage.local.get('irctcArmed');
    if (data.irctcArmed) armedConfig = data.irctcArmed.config;
  }
  if (!armedConfig) return;

  const tabs = await chrome.tabs.query({ url: 'https://www.irctc.co.in/nget/booking/train-list*' })
    .catch(() => []);

  let tab = tabs[0];
  if (!tab) {
    const all = await chrome.tabs.query({ url: 'https://www.irctc.co.in/*' }).catch(() => []);
    tab = all[0];
  }
  if (!tab) {
    chrome.runtime.sendMessage({ type: 'STATUS', text: '❌ No IRCTC tab found', dot: 'error' }).catch(() => {});
    return;
  }

  chrome.tabs.update(tab.id, { active: true });
  chrome.windows.update(tab.windowId, { focused: true });

  chrome.storage.local.get('irctcArmed', data => {
    const cfg = (data.irctcArmed?.config) || armedConfig;
    if (!cfg) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectAutoClicker,
      args: [cfg]
    }).catch(() => {});
  });
}

// ── Injected script ───────────────────────────────────────────────────────────
// This function is serialised and run inside the IRCTC page.
// It must be self-contained — no references to outer scope.

function injectAutoClicker(config) {
  if (window.__irctcRunning) return;
  window.__irctcRunning = true;

  // ── Toast UI injected into the page ──────────────────────────────────────
  const TOAST_ID = '__irctc_toast__';

  function showToast(text, type = 'info') {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      Object.assign(el.style, {
        position:     'fixed',
        top:          '18px',
        right:        '18px',
        zIndex:       '2147483647',
        minWidth:     '220px',
        maxWidth:     '320px',
        padding:      '12px 16px',
        borderRadius: '10px',
        fontFamily:   "'Segoe UI', sans-serif",
        fontSize:     '13px',
        fontWeight:   '600',
        lineHeight:   '1.4',
        boxShadow:    '0 4px 20px rgba(0,0,0,.35)',
        transition:   'opacity .3s',
        pointerEvents:'none',
      });
      document.body.appendChild(el);
    }

    const styles = {
      info:    { bg: '#1e293b', color: '#e2e8f0', border: '#334155' },
      success: { bg: '#14532d', color: '#4ade80', border: '#16a34a' },
      warn:    { bg: '#451a03', color: '#fbbf24', border: '#d97706' },
      error:   { bg: '#450a0a', color: '#f87171', border: '#dc2626' },
    };
    const s = styles[type] || styles.info;
    Object.assign(el.style, {
      background:   s.bg,
      color:        s.color,
      border:       `1px solid ${s.border}`,
      opacity:      '1',
    });
    el.textContent = text;

    if (el._hideTimer) clearTimeout(el._hideTimer);
    // Persistent for info/warn; auto-hide for success/error after 6s
    if (type === 'success' || type === 'error') {
      el._hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 6000);
    }
  }

  function sendStatus(text, dot = '') {
    chrome.runtime.sendMessage({ type: 'CONTENT_STATUS', text, dot });
  }

  function sendDone(success) {
    chrome.runtime.sendMessage({ type: 'CONTENT_DONE', success });
    window.__irctcRunning = false;
    const el = document.getElementById(TOAST_ID);
    if (el) setTimeout(() => el.remove(), 8000);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Wait until no loading spinners are visible (max `timeout` ms)
  const waitForIdle = async (timeout = 15000) => {
    await sleep(300);
    const LOADERS = ['.ng-busy', 'p-progressspinner', '.ui-progress-spinner', '.blockUI',
                     '[class*="loading-overlay"]', '[class*="spinner"]'];
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const busy = LOADERS.some(sel => {
        const el = document.querySelector(sel);
        return el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
      });
      if (!busy) break;
      await sleep(250);
    }
    await sleep(300);
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────

  const CLASS_LABELS = {
    SL: ['Sleeper (SL)', 'Sleeper'],
    '3A': ['AC 3 Tier (3A)', 'AC 3 Tier'],
    '2A': ['AC 2 Tier (2A)', 'AC 2 Tier'],
    '1A': ['AC First Class (1A)', 'AC First Class'],
    CC:  ['Chair Car (CC)', 'Chair Car'],
    EC:  ['Executive Chair Car (EC)', 'Executive Chair Car'],
    '2S': ['Second Sitting (2S)', 'Second Sitting'],
  };

  // Find the <app-train-avl-enq> card that matches the train filter
  function findCard() {
    const cards = [...document.querySelectorAll('app-train-avl-enq')];
    if (!cards.length) return null;
    if (!config.trainFilter) return cards[0];
    const f = config.trainFilter.toUpperCase().trim();
    return cards.find(c => {
      const h = c.querySelector('div.train-heading strong');
      return h ? h.textContent.toUpperCase().includes(f) : c.textContent.toUpperCase().includes(f);
    }) || cards[0];
  }

  // Before class is selected: <td><div class="pre-avl"><div><strong>AC 3 Tier (3A)</strong>...
  function findClassPreAvl(card) {
    const labels = CLASS_LABELS[config.classCode] || [config.classCode];
    for (const el of card.querySelectorAll('div.pre-avl')) {
      const strong = el.querySelector(':scope > div > strong, :scope > div strong');
      if (!strong) continue;
      const txt = strong.textContent.trim();
      if (labels.some(l => txt === l || txt.startsWith(l))) return el;
    }
    return null;
  }

  // After class selected: <li class="ui-tabmenuitem"> <a> ... <strong>AC 3 Tier (3A)</strong>
  function findTabLink(card) {
    const labels = CLASS_LABELS[config.classCode] || [config.classCode];
    for (const li of card.querySelectorAll('li.ui-tabmenuitem')) {
      const txt = li.textContent.trim();
      if (labels.some(l => txt.includes(l.replace(/\s*\(.*\)/, '')))) {
        return li.querySelector('a.ui-menuitem-link') || li;
      }
    }
    return null;
  }

  // First valid date cell: <td class="link ng-star-inserted"><div class="pre-avl">...
  // Must have a <strong> with a month name (skip chevron arrow tds)
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function findFirstDateCell(card) {
    for (const el of card.querySelectorAll('td.link div.pre-avl')) {
      const strong = el.querySelector('strong');
      if (strong && MONTHS.some(m => strong.textContent.includes(m))) return el;
    }
    return null;
  }

  // Book Now is enabled when it loses the "disable-book" class
  function isBookNowActive(card) {
    for (const btn of card.querySelectorAll('button.train_Search, button.btnDefault')) {
      if (!btn.textContent.trim().toLowerCase().includes('book')) continue;
      if (!btn.classList.contains('disable-book') && !btn.classList.contains('disable')) return true;
    }
    return false;
  }

  // One clean click — dispatches the full event chain Angular needs
  function click(el) {
    el.click();
  }

  // Poll until `fn()` returns a truthy element, retrying every `interval` ms
  async function waitForElement(fn, timeout = 12000, interval = 300) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const el = fn();
      if (el) return el;
      await sleep(interval);
    }
    return null;
  }

  // ── Main sequence ──────────────────────────────────────────────────────────

  async function run() {
    showToast('🚀 AutoClicker started…', 'info');
    sendStatus('Starting…', 'armed');

    await waitForIdle(12000);

    // ── 1. Find train card ────────────────────────────────────────────────
    const card = await waitForElement(findCard, 10000);
    if (!card) {
      showToast('❌ Train card not found on page', 'error');
      sendStatus('Failed — no train card', 'error');
      sendDone(false); return;
    }

    const trainName = (card.querySelector('div.train-heading strong')?.textContent || '').trim().slice(0, 35);
    showToast(`🚂 Found: ${trainName || 'train'}`, 'info');

    // ── 2. Click class pre-avl box ────────────────────────────────────────
    showToast(`🔍 Looking for class: ${config.classCode}…`, 'info');
    sendStatus(`Finding class ${config.classCode}…`, 'armed');

    const classEl = await waitForElement(() => findClassPreAvl(card), 10000);
    if (!classEl) {
      showToast(`❌ Class "${config.classCode}" box not found`, 'error');
      sendStatus('Failed — class not found', 'error');
      sendDone(false); return;
    }

    classEl.scrollIntoView({ block: 'center' });
    await sleep(200);
    showToast(`✅ Clicking class: ${config.classCode}`, 'info');
    click(classEl);

    // ── 3. Wait for p-tabmenu, then click the class tab ───────────────────
    showToast('⏳ Waiting for class tabs to load…', 'info');
    sendStatus('Waiting for class tabs…', 'armed');

    await waitForIdle(12000);

    const tabEl = await waitForElement(() => findTabLink(card), 10000);
    if (!tabEl) {
      showToast(`❌ Tab for "${config.classCode}" not found`, 'error');
      sendStatus('Failed — class tab not found', 'error');
      sendDone(false); return;
    }

    tabEl.scrollIntoView({ block: 'center' });
    await sleep(200);
    showToast(`✅ Selecting tab: ${config.classCode}`, 'info');
    click(tabEl);

    // ── 4. Wait for date row, then click first date after 500ms ───────────
    showToast('⏳ Waiting for date row…', 'info');
    sendStatus('Waiting for dates…', 'armed');

    await waitForIdle(12000);

    const dateEl = await waitForElement(() => findFirstDateCell(card), 10000);
    if (!dateEl) {
      showToast('❌ Date row not found', 'error');
      sendStatus('Failed — date row not found', 'error');
      sendDone(false); return;
    }

    const dateText = dateEl.querySelector('strong')?.textContent.trim() || 'first date';
    showToast(`⏱ Clicking "${dateText}" in 500ms…`, 'info');
    sendStatus(`Clicking date: ${dateText}`, 'armed');

    await sleep(200); // deliberate 500ms wait after date row appears
    dateEl.scrollIntoView({ block: 'center' });
    await sleep(100);
    click(dateEl);

    // ── 5. Poll for Book Now to activate ─────────────────────────────────
    showToast('⏳ Waiting for Book Now…', 'info');
    sendStatus('Waiting for Book Now…', 'armed');

    await waitForIdle(10000);

    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (isBookNowActive(card)) {
        showToast('🎉 Book Now is ACTIVE — click it!', 'success');
        sendStatus('✅ Book Now is active!', 'done');
        sendDone(true); return;
      }
      await sleep(300);
    }

    showToast('⚠ Book Now still disabled — check manually', 'warn');
    sendStatus('Done — verify Book Now manually', '');
    sendDone(false);
  }

  run().catch(err => {
    showToast(`❌ Error: ${err.message}`, 'error');
    sendStatus('Error — see page toast', 'error');
    window.__irctcRunning = false;
  });
}
