(() => {
  const ROOT_ATTR = 'data-wmemo-root';
  const STYLE_ID = 'wmemo-style';
  const runtimeHiddenMemoIds = new Set();
  const runtimeHiddenBorderUntil = new Map();
  const BORDER_HIDE_DURATION_MS = 5 * 60 * 1000;
  let lastUrl = location.href;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [${ROOT_ATTR}] { all: initial; font-family: Arial, sans-serif; }
      .wmemo-host { position: fixed; z-index: 2147483647; pointer-events: none; }
      .wmemo-note {
        position: fixed;
        z-index: 2147483646;
        min-width: 180px;
        max-width: 280px;
        border: 1px solid rgba(0,0,0,0.2);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        pointer-events: auto;
        overflow: hidden;
        color: #1f2937;
      }
      .wmemo-note-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        font-size: 12px;
        padding: 6px 8px;
        border-bottom: 1px solid rgba(0,0,0,0.12);
        background: rgba(255,255,255,0.45);
      }
      .wmemo-note-title { font-weight: bold; }
      .wmemo-note-close {
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0;
      }
      .wmemo-note-body {
        white-space: pre-wrap;
        font-size: 13px;
        padding: 8px;
        max-height: 220px;
        overflow: auto;
      }
      .wmemo-border {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: none;
        box-sizing: border-box;
      }
      .wmemo-border-label {
        position: fixed;
        z-index: 2147483647;
        pointer-events: auto;
        background: rgba(0,0,0,0.72);
        color: #fff;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 999px;
        max-width: 40vw;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wmemo-border-close {
        position: fixed;
        top: 8px;
        right: 8px;
        z-index: 2147483647;
        pointer-events: auto;
        border: none;
        border-radius: 999px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
      }
      .wmemo-border-top { top: 8px; left: 50%; transform: translateX(-50%); }
      .wmemo-border-right { top: 50%; right: 8px; transform: translateY(-50%); }
      .wmemo-border-bottom { bottom: 8px; left: 50%; transform: translateX(-50%); }
      .wmemo-border-left { top: 50%; left: 8px; transform: translateY(-50%); }
    `;
    document.documentElement.appendChild(style);
  }

  function getPageKey(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return `${u.origin}${u.pathname}${u.search}`;
    } catch {
      return rawUrl;
    }
  }

  function getParentScope(rawUrl) {
    try {
      const u = new URL(rawUrl);
      const path = u.pathname || '/';
      const parentPath = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1) || '/';
      return `${u.origin}${parentPath}`;
    } catch {
      return rawUrl;
    }
  }

  function matchesScope(entry, currentUrl) {
    const hostname = currentUrl.hostname;
    const pageKey = getPageKey(currentUrl.href);

    if (entry.scopeType === 'domain') {
      return entry.scopeValue === hostname;
    }
    if (entry.scopeType === 'parent') {
      return pageKey.startsWith(entry.scopeValue);
    }
    if (entry.scopeType === 'page') {
      return entry.scopeValue === pageKey;
    }
    return false;
  }

  function scopePriority(scopeType) {
    if (scopeType === 'page') return 3;
    if (scopeType === 'parent') return 2;
    return 1;
  }

  async function getEntries() {
    const result = await chrome.storage.local.get({ entries: [] });
    return Array.isArray(result.entries) ? result.entries : [];
  }

  async function updateEntryPartial(id, patch) {
    const entries = await getEntries();
    const next = entries.map((item) => (item.id === id ? { ...item, ...patch } : item));
    await chrome.storage.local.set({ entries: next });
  }

  function isBorderTemporarilyHidden(id) {
    const hiddenUntil = runtimeHiddenBorderUntil.get(id);
    if (!hiddenUntil) return false;
    if (Date.now() >= hiddenUntil) {
      runtimeHiddenBorderUntil.delete(id);
      return false;
    }
    return true;
  }

  function clearRendered() {
    const existing = document.querySelectorAll(`[${ROOT_ATTR}]`);
    existing.forEach((node) => node.remove());
  }

  function createHost() {
    const host = document.createElement('div');
    host.setAttribute(ROOT_ATTR, '1');
    host.className = 'wmemo-host';
    document.documentElement.appendChild(host);
    return host;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getContrastTextColor(hexColor) {
    const normalized = (hexColor || '').replace('#', '');
    const validHex = /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : 'ef4444';
    const red = parseInt(validHex.slice(0, 2), 16);
    const green = parseInt(validHex.slice(2, 4), 16);
    const blue = parseInt(validHex.slice(4, 6), 16);
    const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
    return yiq >= 145 ? '#111827' : '#ffffff';
  }

  function renderMemo(entry, index) {
    if (runtimeHiddenMemoIds.has(entry.id)) return;

    const note = document.createElement('div');
    note.setAttribute(ROOT_ATTR, '1');
    note.className = 'wmemo-note';
    note.style.background = entry.color || '#fff4a3';

    const x = typeof entry.x === 'number' ? entry.x : 24 + index * 18;
    const y = typeof entry.y === 'number' ? entry.y : 24 + index * 18;
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;

    const header = document.createElement('div');
    header.className = 'wmemo-note-header';

    const title = document.createElement('div');
    title.className = 'wmemo-note-title';
    title.textContent = 'Memo';

    const close = document.createElement('button');
    close.className = 'wmemo-note-close';
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => {
      runtimeHiddenMemoIds.add(entry.id);
      note.remove();
    });

    const body = document.createElement('div');
    body.className = 'wmemo-note-body';
    body.textContent = entry.text || '';

    header.appendChild(title);
    header.appendChild(close);
    note.appendChild(header);
    note.appendChild(body);

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onPointerMove = (ev) => {
      if (!dragging) return;
      const nextX = clamp(ev.clientX - offsetX, 0, window.innerWidth - note.offsetWidth);
      const nextY = clamp(ev.clientY - offsetY, 0, window.innerHeight - note.offsetHeight);
      note.style.left = `${nextX}px`;
      note.style.top = `${nextY}px`;
    };

    const onPointerUp = async () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      const nextX = parseInt(note.style.left, 10) || 0;
      const nextY = parseInt(note.style.top, 10) || 0;
      await updateEntryPartial(entry.id, { x: nextX, y: nextY });
    };

    header.addEventListener('pointerdown', (ev) => {
      dragging = true;
      offsetX = ev.clientX - note.offsetLeft;
      offsetY = ev.clientY - note.offsetTop;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });

    document.documentElement.appendChild(note);
  }

  function renderBorder(entry) {
    const borderColor = entry.color || '#ef4444';
    const renderedNodes = [];

    const border = document.createElement('div');
    border.setAttribute(ROOT_ATTR, '1');
    border.className = 'wmemo-border';
    border.style.border = `4px solid ${borderColor}`;
    renderedNodes.push(border);

    const sides = [
      ['top', 'wmemo-border-top'],
      ['right', 'wmemo-border-right'],
      ['bottom', 'wmemo-border-bottom'],
      ['left', 'wmemo-border-left']
    ];

    for (const [side, className] of sides) {
      const text = entry.labels?.[side];
      if (!text) continue;
      const label = document.createElement('div');
      label.setAttribute(ROOT_ATTR, '1');
      label.className = `wmemo-border-label ${className}`;
      label.style.background = borderColor;
      label.style.color = getContrastTextColor(borderColor);
      label.textContent = text;
      document.documentElement.appendChild(label);
      renderedNodes.push(label);
    }

    const closeButton = document.createElement('button');
    closeButton.setAttribute(ROOT_ATTR, '1');
    closeButton.className = 'wmemo-border-close';
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.title = '暫時關閉 Border 提示（5 分鐘）';
    closeButton.style.background = borderColor;
    closeButton.style.color = getContrastTextColor(borderColor);
    closeButton.addEventListener('click', () => {
      const hiddenUntil = Date.now() + BORDER_HIDE_DURATION_MS;
      runtimeHiddenBorderUntil.set(entry.id, hiddenUntil);
      renderedNodes.forEach((node) => node.remove());

      setTimeout(() => {
        const currentHiddenUntil = runtimeHiddenBorderUntil.get(entry.id);
        if (currentHiddenUntil !== hiddenUntil) return;
        runtimeHiddenBorderUntil.delete(entry.id);
        renderAll();
      }, BORDER_HIDE_DURATION_MS);
    });

    document.documentElement.appendChild(closeButton);
    renderedNodes.push(closeButton);

    document.documentElement.appendChild(border);
  }

  async function renderAll() {
    ensureStyles();
    clearRendered();

    let currentUrl;
    try {
      currentUrl = new URL(location.href);
    } catch {
      return;
    }

    const entries = await getEntries();
    const matched = entries.filter((entry) => matchesScope(entry, currentUrl));
    const matchedBorders = matched
      .filter((entry) => entry.type === 'border')
      .sort((a, b) => {
        const byScope = scopePriority(b.scopeType) - scopePriority(a.scopeType);
        if (byScope !== 0) return byScope;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    const selectedBorder = matchedBorders[0] || null;

    let memoIndex = 0;
    for (const entry of matched) {
      if (entry.type === 'memo') {
        renderMemo(entry, memoIndex++);
      }
    }

    if (selectedBorder && !isBorderTemporarilyHidden(selectedBorder.id)) {
      renderBorder(selectedBorder);
    }
  }

  function handleUrlChanged() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    runtimeHiddenMemoIds.clear();
    runtimeHiddenBorderUntil.clear();
    renderAll();
  }

  function hookHistory() {
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPush.apply(this, args);
      setTimeout(handleUrlChanged, 0);
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplace.apply(this, args);
      setTimeout(handleUrlChanged, 0);
      return result;
    };

    window.addEventListener('popstate', handleUrlChanged);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.entries) return;
    renderAll();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'REFRESH_OVERLAYS') {
      renderAll();
    }
  });

  hookHistory();
  renderAll();
})();
