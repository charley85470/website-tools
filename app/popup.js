(() => {
  const state = {
    mode: 'clipboard',
    tabId: null,
    currentUrl: null,
    context: null,
    editingBorderId: null
  };

  const modeMemoBtn = document.getElementById('modeMemo');
  const modeBorderBtn = document.getElementById('modeBorder');
  const modeClipboardBtn = document.getElementById('modeClipboard');
  const memoPanel = document.getElementById('memoPanel');
  const borderPanel = document.getElementById('borderPanel');
  const clipboardPanel = document.getElementById('clipboardPanel');
  const scopeCard = document.getElementById('scopeCard');
  const availabilityNoticeEl = document.getElementById('availabilityNotice');
  const interactiveAreaEl = document.getElementById('interactiveArea');

  const scopeTypeTabButtons = [...document.querySelectorAll('#scopeTypeTabs button')];
  const parentScopeInput = document.getElementById('parentScopeInput');
  const parentScopeGroup = document.getElementById('parentScopeGroup');
  const scopePreview = document.getElementById('scopePreview');
  const statusEl = document.getElementById('popupStatus');
  const borderColorInput = document.getElementById('borderColor');
  const borderWidthInput = document.getElementById('borderWidth');
  const borderVisibleInput = document.getElementById('borderVisible');
  const cursorBannerVisibleInput = document.getElementById('cursorBannerVisible');
  const borderColorPresetButtons = [...document.querySelectorAll('#borderColorPresets .color-swatch')];
    const addBorderBtn = document.getElementById('addBorder');

  function showStatus(message, isError = false, showOnMemo = true) {
    if (!showOnMemo && state.mode !== 'border') {
      statusEl.textContent = '';
      return;
    }
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#b91c1c' : '#047857';
  }

  function showAvailabilityNotice(message = '') {
    if (!availabilityNoticeEl) return;
    availabilityNoticeEl.textContent = message;
    availabilityNoticeEl.classList.toggle('hidden', !message);
  }

  function syncBorderPresetActiveState() {
    const current = (borderColorInput.value || '').toLowerCase();
    borderColorPresetButtons.forEach((button) => {
      const color = (button.dataset.color || '').toLowerCase();
      button.classList.toggle('active', color === current);
    });
  }

  function getPageKey(rawUrl) {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}${u.search}`;
  }

  function getParentScope(rawUrl) {
    const u = new URL(rawUrl);
    const path = u.pathname || '/';
    const parentPath = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1) || '/';
    return `${u.origin}${parentPath}`;
  }

  function matchesScope(entry, currentUrl) {
    const pageKey = getPageKey(currentUrl.href);
    if (entry.scopeType === 'domain') {
      return entry.scopeValue === currentUrl.hostname;
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

  function getBorderScopeKey(entry) {
    return `${entry.domain}::${entry.scopeType}::${entry.scopeValue}`;
  }

  function setScopeTypeAndValue(scopeType, scopeValue) {
    const target = scopeTypeTabButtons.find((button) => button.dataset.scope === scopeType) || scopeTypeTabButtons[0];
    scopeTypeTabButtons.forEach((button) => button.classList.toggle('active', button === target));
    if (scopeType === 'parent' && scopeValue) {
      parentScopeInput.value = scopeValue;
    }
    refreshScopePreview();
  }

  async function autofillBorderFormFromCurrentPage() {
    if (!state.currentUrl || !state.context) return;

    const allEntries = await getEntries();
    const currentUrl = new URL(state.currentUrl);
    const candidates = allEntries
      .filter((entry) => entry.type === 'border')
      .filter((entry) => matchesScope(entry, currentUrl));

    if (!candidates.length) {
      state.editingBorderId = null;
      updateBorderButtonLabel();
      return false;
    }

    candidates.sort((a, b) => {
      const byScope = scopePriority(b.scopeType) - scopePriority(a.scopeType);
      if (byScope !== 0) return byScope;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const target = candidates[0];
    state.editingBorderId = target.id;
    updateBorderButtonLabel();
    setScopeTypeAndValue(target.scopeType, target.scopeValue);
    borderColorInput.value = target.color || '#ef4444';
    syncBorderPresetActiveState();
    borderWidthInput.value = target.borderWidth ?? 4;
    borderVisibleInput.checked = target.borderVisible !== false;
    cursorBannerVisibleInput.checked = target.cursorBannerVisible !== false;

    const labels = target.labels || {};
    document.getElementById('labelTop').value = labels.top || '';
    document.getElementById('labelRight').value = labels.right || '';
    document.getElementById('labelBottom').value = labels.bottom || '';
    document.getElementById('labelLeft').value = labels.left || '';
    return true;
  }

  function buildContext(url) {
    const u = new URL(url);
    return {
      domain: u.hostname,
      parent: getParentScope(url),
      page: getPageKey(url)
    };
  }

  function currentScopeType() {
    const selected = scopeTypeTabButtons.find((button) => button.classList.contains('active'));
    return selected ? selected.dataset.scope : 'domain';
  }

  function getScopeValue(type) {
    if (type === 'domain') return state.context.domain;
    if (type === 'parent') return parentScopeInput.value.trim();
    return state.context.page;
  }

  function refreshScopePreview() {
    if (!state.context) return;
    const type = currentScopeType();
    const value = getScopeValue(type);
    scopePreview.textContent = `目前作用域：${value}`;
    parentScopeInput.disabled = type !== 'parent';
    if (parentScopeGroup) {
      parentScopeGroup.classList.toggle('hidden', type !== 'parent');
    }
  }

    function updateBorderButtonLabel() {
      if (!addBorderBtn) return;
      addBorderBtn.textContent = state.editingBorderId ? '更新 Border' : '新增 Border';
    }

  function setMode(mode) {
    state.mode = mode;
    const isMemo = mode === 'memo';
    const isBorder = mode === 'border';
    const isClipboard = mode === 'clipboard';
    memoPanel.classList.toggle('hidden', !isMemo);
    borderPanel.classList.toggle('hidden', !isBorder);
    clipboardPanel.classList.toggle('hidden', !isClipboard);
    if (scopeCard) scopeCard.classList.toggle('hidden', isClipboard);
    modeMemoBtn.classList.toggle('active', isMemo);
    modeBorderBtn.classList.toggle('active', isBorder);
    modeClipboardBtn.classList.toggle('active', isClipboard);

    const noContext = !state.context;
    document.getElementById('memoSiteNotice')?.classList.toggle('hidden', !isMemo || !noContext);
    document.getElementById('borderSiteNotice')?.classList.toggle('hidden', !isBorder || !noContext);
    document.getElementById('memoFormContent')?.classList.toggle('hidden', isMemo && noContext);
    document.getElementById('borderFormContent')?.classList.toggle('hidden', isBorder && noContext);

    if (isBorder) {
      autofillBorderFormFromCurrentPage()
        .then((loaded) => {
          if (loaded) {
            showStatus('已載入現有 Border 設定', false, false);
          }
        })
        .catch((err) => showStatus(err.message, true));
    } else {
      showStatus('');
    }
  }

  async function getEntries() {
    const result = await chrome.storage.local.get({ entries: [] });
    return result.entries;
  }

  async function saveEntry(entry) {
    const entries = await getEntries();
    entries.push(entry);
    await chrome.storage.local.set({ entries });
  }

  async function saveEntries(entries) {
    await chrome.storage.local.set({ entries });
  }

  async function notifyRefresh() {
    if (!state.tabId) return;
    try {
      await chrome.tabs.sendMessage(state.tabId, { type: 'REFRESH_OVERLAYS' });
    } catch {
    }
  }

  async function addMemo() {
    if (!state.context) {
      showStatus('請在一般網站頁面使用此功能', true);
      return;
    }
    const memoText = document.getElementById('memoText').value.trim();
    const memoColor = document.getElementById('memoColor').value;

    if (!memoText) {
      showStatus('請先輸入 memo 內容', true);
      return;
    }

    const scopeType = currentScopeType();
    const scopeValue = getScopeValue(scopeType);
    const entry = {
      id: crypto.randomUUID(),
      type: 'memo',
      domain: state.context.domain,
      scopeType,
      scopeValue,
      text: memoText,
      color: memoColor,
      createdAt: Date.now()
    };

    await saveEntry(entry);
    await notifyRefresh();
    document.getElementById('memoText').value = '';
    showStatus('Memo 已新增');
  }

  async function addBorder() {
    if (!state.context) {
      showStatus('請在一般網站頁面使用此功能', true);
      return;
    }
    const scopeType = currentScopeType();
    const scopeValue = getScopeValue(scopeType);
    const borderColor = borderColorInput.value;

    const borderWidthValue = Math.max(1, Math.min(20, parseInt(borderWidthInput.value, 10) || 4));
    const payload = {
      domain: state.context.domain,
      scopeType,
      scopeValue,
      color: borderColor,
      borderWidth: borderWidthValue,
      borderVisible: borderVisibleInput.checked,
      cursorBannerVisible: cursorBannerVisibleInput.checked,
      labels: {
        top: document.getElementById('labelTop').value.trim(),
        right: document.getElementById('labelRight').value.trim(),
        bottom: document.getElementById('labelBottom').value.trim(),
        left: document.getElementById('labelLeft').value.trim()
      }
    };

    const entries = await getEntries();
    const hasEditingTarget = state.editingBorderId && entries.some((item) => item.id === state.editingBorderId);
    const scopeKey = getBorderScopeKey(payload);
    const existingSameScope = entries.find((item) => item.type === 'border' && getBorderScopeKey(item) === scopeKey);

    let targetId = hasEditingTarget ? state.editingBorderId : null;
    if (existingSameScope && existingSameScope.id !== targetId) {
      targetId = existingSameScope.id;
    }

    let nextEntries;
    let isUpdate = false;

    if (targetId) {
      isUpdate = true;
      nextEntries = entries.map((item) => (item.id === targetId ? { ...item, ...payload } : item));
    } else {
      const entry = {
        id: crypto.randomUUID(),
        type: 'border',
        ...payload,
        createdAt: Date.now()
      };
      targetId = entry.id;
      nextEntries = [...entries, entry];
    }

    nextEntries = nextEntries.filter((item) => {
      if (item.type !== 'border') return true;
      if (getBorderScopeKey(item) !== scopeKey) return true;
      return item.id === targetId;
    });

    state.editingBorderId = targetId;
    updateBorderButtonLabel();
    await saveEntries(nextEntries);

    await notifyRefresh();
    showStatus(isUpdate ? 'Border 已更新' : 'Border 已新增');
  }

  async function initialize() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https?:/.test(tab.url)) {
      state.tabId = tab.id;
      state.currentUrl = tab.url;
      state.context = buildContext(tab.url);
      parentScopeInput.value = state.context.parent;
      refreshScopePreview();
    }
    setMode(state.mode);
  }

  scopeTypeTabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      scopeTypeTabButtons.forEach((item) => item.classList.toggle('active', item === button));
        state.editingBorderId = null;
        updateBorderButtonLabel();
      refreshScopePreview();
    });
  });
  parentScopeInput.addEventListener('input', refreshScopePreview);
  borderColorInput.addEventListener('input', syncBorderPresetActiveState);
  borderColorPresetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const color = button.dataset.color;
      if (!color) return;
      borderColorInput.value = color;
      syncBorderPresetActiveState();
    });
  });

  modeMemoBtn.addEventListener('click', () => setMode('memo'));
  modeBorderBtn.addEventListener('click', () => setMode('border'));
  modeClipboardBtn.addEventListener('click', () => setMode('clipboard'));

  document.getElementById('addMemo').addEventListener('click', () => addMemo().catch((err) => showStatus(err.message, true)));
  document.getElementById('addBorder').addEventListener('click', () => addBorder().catch((err) => showStatus(err.message, true)));
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Clipboard 功能 ────────────────────────────────────────────
  const clipboardListEl = document.getElementById('clipboardList');
  const clipboardEmptyMsg = document.getElementById('clipboardEmptyMsg');
  const clipboardCountEl = document.getElementById('clipboardCount');
  const clipboardNewText = document.getElementById('clipboardNewText');
  const clipboardAddForm = document.getElementById('clipboardAddForm');
  const clipboardClearBtn = document.getElementById('clipboardClearBtn');

  function renderClipboardList(items) {
    clipboardListEl.innerHTML = '';
    clipboardCountEl.textContent = (items || []).length;
    if (!items || items.length === 0) {
      clipboardEmptyMsg.classList.remove('hidden');
      return;
    }
    clipboardEmptyMsg.classList.add('hidden');

    items.forEach((text, index) => {
      const li = document.createElement('li');
      li.className = 'clipboard-item';
      li.title = text;

      const span = document.createElement('span');
      span.className = 'clipboard-item-text';
      span.textContent = text;
      span.title = text;

      const actions = document.createElement('div');
      actions.className = 'clipboard-item-actions';

      const insertBtn = document.createElement('button');
      insertBtn.className = 'clipboard-btn';
      insertBtn.textContent = '插入';
      insertBtn.title = '插入至目前聚焦的輸入框';
      insertBtn.type = 'button';
      insertBtn.onclick = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || !tabs[0] || !tabs[0].id) return;
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (txt) => {
              try {
                const active = document.activeElement;
                if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type !== 'file'))) {
                  const s = typeof active.selectionStart === 'number' ? active.selectionStart : active.value.length;
                  const e = typeof active.selectionEnd === 'number' ? active.selectionEnd : s;
                  active.value = active.value.slice(0, s) + txt + active.value.slice(e);
                  active.selectionStart = active.selectionEnd = s + txt.length;
                  active.focus();
                  return true;
                }
                if (active && active.isContentEditable) {
                  const sel = window.getSelection();
                  if (!sel || sel.rangeCount === 0) return false;
                  const range = sel.getRangeAt(0);
                  range.deleteContents();
                  const node = document.createTextNode(txt);
                  range.insertNode(node);
                  range.setStartAfter(node);
                  range.setEndAfter(node);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  return true;
                }
                return false;
              } catch (_) { return false; }
            },
            args: [text]
          });
        });
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'clipboard-btn clipboard-btn-danger';
      delBtn.textContent = '刪除';
      delBtn.title = '刪除此片段';
      delBtn.type = 'button';
      delBtn.onclick = () => {
        const updated = items.filter((_, i) => i !== index);
        chrome.storage.local.set({ clipboard: updated }, () => renderClipboardList(updated));
      };

      actions.appendChild(insertBtn);
      actions.appendChild(delBtn);
      li.appendChild(span);
      li.appendChild(actions);
      clipboardListEl.appendChild(li);
    });
  }

  // 初始載入片段
  chrome.storage.local.get({ clipboard: [] }, (data) => renderClipboardList(data.clipboard));

  // 即時同步其他視窗的變更（例如右鍵選單新增）
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.clipboard) {
      renderClipboardList(changes.clipboard.newValue || []);
    }
  });

  clipboardAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = clipboardNewText.value.trim();
    if (!value) { clipboardNewText.focus(); return; }
    chrome.storage.local.get({ clipboard: [] }, (data) => {
      const updated = [value, ...(data.clipboard || [])];
      chrome.storage.local.set({ clipboard: updated }, () => {
        renderClipboardList(updated);
        clipboardNewText.value = '';
        clipboardNewText.focus();
      });
    });
  });

  clipboardClearBtn.addEventListener('click', () => {
    clipboardNewText.value = '';
    clipboardNewText.focus();
  });

  clipboardNewText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      clipboardAddForm.dispatchEvent(new Event('submit'));
    }
  });

  // ── End Clipboard 功能 ───────────────────────────────────────

  syncBorderPresetActiveState();
  updateBorderButtonLabel();
  initialize().catch((err) => showStatus(err.message, true));
})();
