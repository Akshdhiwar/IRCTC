// popup.js
const $ = id => document.getElementById(id);
let ticker = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(text, dotCls = '') {
  const el = $('statusText');
  el.textContent = text;
  el.className = 'status' + (dotCls === 'armed' ? ' active' : dotCls === 'done' ? ' done' : '');
  $('dot').className = 'dot ' + dotCls;
}

function fmt(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
}

function startTick(targetMs) {
  $('countdown').style.display = 'block';
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    const left = targetMs - Date.now();
    $('countdown').textContent = left <= 0 ? '——' : fmt(left);
    if (left <= 0) { clearInterval(ticker); ticker = null; }
  }, 200);
}

function stopTick() {
  if (ticker) { clearInterval(ticker); ticker = null; }
  $('countdown').style.display = 'none';
}

function getValues() {
  return {
    trainFilter : $('trainFilter').value.trim(),
    classCode   : $('classSelect').value,
    clickTime   : $('clickTime').value,
  };
}

function applyValues(c) {
  if (c.trainFilter !== undefined) $('trainFilter').value = c.trainFilter;
  if (c.classCode)                 $('classSelect').value = c.classCode;
  if (c.clickTime)                 $('clickTime').value   = c.clickTime;
}

function setArmedUI(targetTime) {
  $('armBtn').disabled  = true;
  $('stopBtn').disabled = false;
  setStatus('armed — waiting', 'armed');
  startTick(targetTime);
}

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.local.get(['irctcConfig', 'irctcArmed'], data => {
  if (data.irctcConfig) applyValues(data.irctcConfig);
  if (data.irctcArmed?.active && data.irctcArmed.targetTime > Date.now()) {
    setArmedUI(data.irctcArmed.targetTime);
  }
});

// ── Test-in-N-seconds ─────────────────────────────────────────────────────────

$('testInBtn').addEventListener('click', () => {
  const secs = Math.max(3, parseInt($('testSeconds').value) || 10);
  const at = new Date(Date.now() + secs * 1000);
  $('clickTime').value =
    `${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}:${String(at.getSeconds()).padStart(2,'0')}`;
  setStatus(`fire time set +${secs}s`, '');
});

// ── Save ──────────────────────────────────────────────────────────────────────

$('saveBtn').addEventListener('click', () => {
  chrome.storage.local.set({ irctcConfig: getValues() }, () => {
    setStatus('saved', 'done');
    setTimeout(() => setStatus('ready', ''), 2000);
  });
});

// ── Arm ───────────────────────────────────────────────────────────────────────

$('armBtn').addEventListener('click', () => {
  const vals = getValues();
  if (!vals.clickTime) { setStatus('set a fire time first', 'error'); return; }

  const [hh, mm, ss] = vals.clickTime.split(':').map(Number);
  const fireAt = new Date();
  fireAt.setHours(hh, mm, ss || 0, 0);

  if (fireAt <= new Date()) {
    setStatus('time already passed', 'error');
    return;
  }

  const payload = { active: true, targetTime: fireAt.getTime(), config: vals };

  chrome.storage.local.set({ irctcConfig: vals, irctcArmed: payload }, () => {
    chrome.runtime.sendMessage({ type: 'ARM', targetTime: fireAt.getTime(), config: vals }, () => {
      setArmedUI(fireAt.getTime());
    });
  });
});

// ── Stop ──────────────────────────────────────────────────────────────────────

$('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DISARM' }, () => {
    chrome.storage.local.remove('irctcArmed');
    stopTick();
    $('armBtn').disabled  = false;
    $('stopBtn').disabled = true;
    setStatus('disarmed', '');
  });
});

// ── Messages from background ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'STATUS') setStatus(msg.text, msg.dot || '');

  if (msg.type === 'FIRED') {
    stopTick();
    $('countdown').textContent = '——';
    $('countdown').style.display = 'block';
    setStatus('executing…', 'armed');
  }

  if (msg.type === 'DONE') {
    stopTick();
    $('armBtn').disabled  = false;
    $('stopBtn').disabled = true;
    setStatus(msg.success ? 'book now is active' : 'done — verify manually', msg.success ? 'done' : '');
    chrome.storage.local.remove('irctcArmed');
  }
});