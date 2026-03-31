(() => {
  const tabClipboardBtn = document.getElementById('tabClipboard');
  const tabMemoBtn = document.getElementById('tabMemo');
  const tabBorderBtn = document.getElementById('tabBorder');
  const clipboardList = document.getElementById('clipboardList');
  const memoList = document.getElementById('memoList');
  const borderList = document.getElementById('borderList');
  const domainPicker = document.getElementById('domainPicker');
  const domainSelect = document.getElementById('domainSelect');
  const exportJsonBtn = document.getElementById('exportJson');
  const importJsonBtn = document.getElementById('importJson');
  const importFileInput = document.getElementById('importFile');
  const backupStatus = document.getElementById('backupStatus');
  const itemTemplate = document.getElementById('itemTemplate');

  const state = {
    tab: 'clipboard',
    selectedDomain: '',
    entries: [],
    clipboardItems: []
  };

  const BORDER_PRESET_COLORS = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#3b82f6',
    '#4f46e5',
    '#a855f7'
  ];

  function formatScope(entry) {
    if (entry.scopeType === 'domain') return `domain: ${entry.scopeValue}`;
    if (entry.scopeType === 'parent') return `父目錄: ${entry.scopeValue}`;
    return `單頁: ${entry.scopeValue}`;
  }

  function showBackupStatus(message, isError = false) {
    backupStatus.textContent = message;
    backupStatus.style.color = isError ? '#b91c1c' : '#047857';
  }

  function getUniqueDomains(entries) {
    return [...new Set(entries.map((entry) => entry.domain).filter(Boolean))].sort();
  }

  function getDomainsForTab(entries, tab) {
    return getUniqueDomains(entries.filter((entry) => entry.type === tab));
  }

  async function getEntries() {
    const result = await chrome.storage.local.get({ entries: [] });
    return Array.isArray(result.entries) ? result.entries : [];
  }

  async function setEntries(entries) {
    await chrome.storage.local.set({ entries: normalizeEntries(entries) });
  }

  function getBorderScopeKey(entry) {
    return `${entry.domain}::${entry.scopeType}::${entry.scopeValue}`;
  }

  function normalizeEntries(entries) {
    const borderMap = new Map();
    const memoEntries = [];

    entries.forEach((entry) => {
      if (entry.type !== 'border') {
        memoEntries.push(entry);
        return;
      }

      const key = getBorderScopeKey(entry);
      const current = borderMap.get(key);
      if (!current || (entry.createdAt || 0) >= (current.createdAt || 0)) {
        borderMap.set(key, entry);
      }
    });

    return [...memoEntries, ...borderMap.values()];
  }

  function sanitizeScopeType(scopeType) {
    return ['domain', 'parent', 'page'].includes(scopeType) ? scopeType : 'page';
  }

  function sanitizeText(value) {
    return typeof value === 'string' ? value : '';
  }

  function sanitizeColor(value, fallback) {
    if (typeof value !== 'string') return fallback;
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  }

  function sanitizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const type = entry.type === 'border' ? 'border' : entry.type === 'memo' ? 'memo' : null;
    if (!type) return null;

    const normalized = {
      id: typeof entry.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
      type,
      domain: sanitizeText(entry.domain),
      scopeType: sanitizeScopeType(entry.scopeType),
      scopeValue: sanitizeText(entry.scopeValue),
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now()
    };

    if (type === 'memo') {
      normalized.text = sanitizeText(entry.text);
      normalized.color = sanitizeColor(entry.color, '#fff4a3');
      if (typeof entry.x === 'number') normalized.x = entry.x;
      if (typeof entry.y === 'number') normalized.y = entry.y;
      return normalized;
    }

    const labels = entry.labels && typeof entry.labels === 'object' ? entry.labels : {};
    normalized.color = sanitizeColor(entry.color, '#ef4444');
    normalized.labels = {
      top: sanitizeText(labels.top),
      right: sanitizeText(labels.right),
      bottom: sanitizeText(labels.bottom),
      left: sanitizeText(labels.left)
    };
    return normalized;
  }

  function extractEntriesFromImportedJson(rawData) {
    if (Array.isArray(rawData)) return rawData;
    if (rawData && typeof rawData === 'object' && Array.isArray(rawData.entries)) {
      return rawData.entries;
    }
    return null;
  }

  async function exportAsJsonBackup() {
    const clipResult = await chrome.storage.local.get({ clipboard: [] });
    const payload = {
      app: 'website-memo',
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: state.entries,
      clipboard: Array.isArray(clipResult.clipboard) ? clipResult.clipboard : []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `website-memo-backup-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showBackupStatus('JSON 備份已匯出');
  }

  async function importFromJsonBackup(file) {
    if (!file) return;

    let parsed;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      showBackupStatus('匯入失敗：JSON 格式錯誤', true);
      return;
    }

    const rawEntries = extractEntriesFromImportedJson(parsed);
    if (!rawEntries) {
      showBackupStatus('匯入失敗：找不到 entries 陣列', true);
      return;
    }

    const sanitizedEntries = normalizeEntries(rawEntries
      .map((entry) => sanitizeEntry(entry))
      .filter((entry) => Boolean(entry)));

    await setEntries(sanitizedEntries);
    state.entries = sanitizedEntries;

    let clipboardCount = 0;
    if (Array.isArray(parsed.clipboard)) {
      const normalized = parsed.clipboard
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0);
      await chrome.storage.local.set({ clipboard: normalized });
      state.clipboardItems = normalized;
      clipboardCount = normalized.length;
    }

    render();
    const msg = clipboardCount > 0
      ? `匯入完成：entries ${sanitizedEntries.length} 筆、clipboard ${clipboardCount} 筆`
      : `匯入完成：共 ${sanitizedEntries.length} 筆`;
    showBackupStatus(msg);
  }

  async function deleteEntry(id) {
    const next = state.entries.filter((entry) => entry.id !== id);
    state.entries = next;
    await setEntries(next);
    render();
  }

  async function updateEntry(id, patch) {
    const next = state.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
    state.entries = next;
    await setEntries(next);
    render();
  }

  function createScopeSummary(entry) {
    const wrapper = document.createElement('div');
    wrapper.className = 'edit-row scope-summary';
    const text = document.createElement('div');
    text.textContent = formatScope(entry);
    wrapper.appendChild(text);
    return wrapper;
  }

  function createBorderColorPresets(colorInput) {
    const wrapper = document.createElement('div');
    wrapper.className = 'color-presets';

    const syncActive = () => {
      const current = (colorInput.value || '').toLowerCase();
      [...wrapper.querySelectorAll('.color-swatch')].forEach((button) => {
        button.classList.toggle('active', (button.dataset.color || '').toLowerCase() === current);
      });
    };

    BORDER_PRESET_COLORS.forEach((color) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch';
      button.dataset.color = color;
      button.style.setProperty('--swatch-color', color);
      button.title = color;
      button.addEventListener('click', () => {
        colorInput.value = color;
        syncActive();
      });
      wrapper.appendChild(button);
    });

    colorInput.addEventListener('input', syncActive);
    syncActive();
    return wrapper;
  }

  function buildMemoItem(entry) {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    const memoMeta = node.querySelector('.meta');
    const memoSwatch = document.createElement('span');
    memoSwatch.className = 'item-color-swatch';
    memoSwatch.style.background = entry.color || '#fff4a3';
    memoMeta.appendChild(memoSwatch);
    memoMeta.appendChild(document.createTextNode(formatScope(entry)));
    node.querySelector('.item-content').textContent = entry.text || '';

    const form = node.querySelector('.edit-form');
    form.appendChild(createScopeSummary(entry));

    const textRow = document.createElement('div');
    textRow.className = 'edit-row';
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Memo 內容';
    const textArea = document.createElement('textarea');
    textArea.name = 'text';
    textArea.rows = 3;
    textArea.value = entry.text || '';
    textRow.appendChild(textLabel);
    textRow.appendChild(textArea);

    const colorRow = document.createElement('div');
    colorRow.className = 'edit-row';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = '顏色';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.name = 'color';
    colorInput.value = entry.color || '#fff4a3';
    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorInput);

    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = '儲存';

    form.appendChild(textRow);
    form.appendChild(colorRow);
    form.appendChild(save);

    node.querySelector('.btn-edit').addEventListener('click', () => {
      form.classList.toggle('hidden');
    });

    node.querySelector('.btn-delete').addEventListener('click', () => {
      if (confirm('確定要刪除此備忘錄嗎？')) deleteEntry(entry.id);
    });

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      updateEntry(entry.id, {
        text: form.elements.text.value,
        color: form.elements.color.value
      });
    });

    return node;
  }

  function buildBorderItem(entry) {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.meta').textContent = formatScope(entry);

    const labels = entry.labels || {};
    const contentEl = node.querySelector('.item-content');
    const colorLine = document.createElement('div');
    colorLine.className = 'item-content-color-line';
    const borderSwatch = document.createElement('span');
    borderSwatch.className = 'item-color-swatch';
    borderSwatch.style.background = entry.color || '#ef4444';
    colorLine.appendChild(borderSwatch);
    colorLine.appendChild(document.createTextNode(`color: ${entry.color || '#ef4444'}`));
    contentEl.appendChild(colorLine);
    const labelLines = [
      labels.top && `top: ${labels.top}`,
      labels.right && `right: ${labels.right}`,
      labels.bottom && `bottom: ${labels.bottom}`,
      labels.left && `left: ${labels.left}`
    ].filter(Boolean).join('\n');
    if (labelLines) {
      const labelDiv = document.createElement('div');
      labelDiv.textContent = labelLines;
      contentEl.appendChild(labelDiv);
    }

    const form = node.querySelector('.edit-form');
    form.appendChild(createScopeSummary(entry));

    const colorRow = document.createElement('div');
    colorRow.className = 'edit-row';
    colorRow.innerHTML = '<label>顏色</label>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.name = 'color';
    colorInput.value = entry.color || '#ef4444';
    colorRow.appendChild(colorInput);
    colorRow.appendChild(createBorderColorPresets(colorInput));

    const sides = ['top', 'right', 'bottom', 'left'];
    const sideFields = {};
    for (const side of sides) {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const label = document.createElement('label');
      label.textContent = `${side} 文字`;
      const input = document.createElement('input');
      input.type = 'text';
      input.name = `label_${side}`;
      input.value = labels[side] || '';
      row.appendChild(label);
      row.appendChild(input);
      form.appendChild(row);
      sideFields[side] = input;
    }

    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = '儲存';

    form.appendChild(colorRow);
    form.appendChild(save);

    node.querySelector('.btn-edit').addEventListener('click', () => {
      form.classList.toggle('hidden');
    });

    node.querySelector('.btn-delete').addEventListener('click', () => {
      if (confirm('確定要刪除此框線設定嗎？')) deleteEntry(entry.id);
    });

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      updateEntry(entry.id, {
        color: form.elements.color.value,
        labels: {
          top: sideFields.top.value.trim(),
          right: sideFields.right.value.trim(),
          bottom: sideFields.bottom.value.trim(),
          left: sideFields.left.value.trim()
        }
      });
    });

    return node;
  }

  function buildClipboardItem(text, index) {
    const node = document.createElement('article');
    node.className = 'item item-clipboard';

    const head = document.createElement('div');
    head.className = 'item-head';

    const textMeta = document.createElement('div');
    textMeta.className = 'clipboard-text-meta';
    textMeta.textContent = text;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete danger';
    delBtn.textContent = '刪除';
    delBtn.addEventListener('click', () => {
      if (confirm('確定要刪除此剪貼簿項目嗎？')) {
        const updated = state.clipboardItems.filter((_, i) => i !== index);
        state.clipboardItems = updated;
        chrome.storage.local.set({ clipboard: updated }, () => render());
      }
    });

    actions.appendChild(delBtn);
    head.appendChild(textMeta);
    head.appendChild(actions);
    node.appendChild(head);
    return node;
  }

  function renderClipboardItems() {
    clipboardList.innerHTML = '';
    if (!state.clipboardItems || state.clipboardItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '目前沒有剪貼簿項目';
      clipboardList.appendChild(empty);
      return;
    }
    state.clipboardItems.forEach((text, index) => {
      clipboardList.appendChild(buildClipboardItem(text, index));
    });
  }

  function renderList(container, items, builder) {
    container.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '目前沒有資料';
      container.appendChild(empty);
      return;
    }

    for (const item of items) {
      container.appendChild(builder(item));
    }
  }

  function renderDomainSelect() {
    const domains = getDomainsForTab(state.entries, state.tab);
    domainSelect.innerHTML = '';

    if (!domains.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '無資料';
      domainSelect.appendChild(option);
      state.selectedDomain = '';
      return;
    }

    if (!domains.includes(state.selectedDomain)) {
      state.selectedDomain = domains[0];
    }

    for (const domain of domains) {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      option.selected = domain === state.selectedDomain;
      domainSelect.appendChild(option);
    }
  }

  function render() {
    const isClipboard = state.tab === 'clipboard';
    const memoActive = state.tab === 'memo';

    tabClipboardBtn.classList.toggle('active', isClipboard);
    tabMemoBtn.classList.toggle('active', memoActive);
    tabBorderBtn.classList.toggle('active', state.tab === 'border');

    domainPicker.classList.toggle('hidden', isClipboard);
    clipboardList.classList.toggle('hidden', !isClipboard);
    memoList.classList.toggle('hidden', !memoActive);
    borderList.classList.toggle('hidden', state.tab !== 'border');

    if (isClipboard) {
      renderClipboardItems();
      return;
    }

    renderDomainSelect();

    const domainEntries = state.selectedDomain
      ? state.entries.filter((entry) => entry.domain === state.selectedDomain)
      : [];

    const memoItems = domainEntries.filter((entry) => entry.type === 'memo');
    const borderItems = domainEntries.filter((entry) => entry.type === 'border');

    renderList(memoList, memoItems, buildMemoItem);
    renderList(borderList, borderItems, buildBorderItem);
  }

  async function preselectDomainFromActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https?:/.test(tab.url)) return;
      state.selectedDomain = new URL(tab.url).hostname;
    } catch {
    }
  }

  async function initialize() {
    state.entries = await getEntries();
    const clipResult = await chrome.storage.local.get({ clipboard: [] });
    state.clipboardItems = Array.isArray(clipResult.clipboard) ? clipResult.clipboard : [];
    await preselectDomainFromActiveTab();
    render();
  }

  tabClipboardBtn.addEventListener('click', () => {
    state.tab = 'clipboard';
    render();
  });

  tabMemoBtn.addEventListener('click', () => {
    state.tab = 'memo';
    render();
  });

  tabBorderBtn.addEventListener('click', () => {
    state.tab = 'border';
    render();
  });

  domainSelect.addEventListener('change', () => {
    state.selectedDomain = domainSelect.value;
    render();
  });

  exportJsonBtn.addEventListener('click', () => {
    exportAsJsonBackup();
  });

  importJsonBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files && importFileInput.files[0];
    await importFromJsonBackup(file);
    importFileInput.value = '';
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.entries) {
      state.entries = Array.isArray(changes.entries.newValue) ? changes.entries.newValue : [];
      render();
    }
    if (changes.clipboard) {
      state.clipboardItems = Array.isArray(changes.clipboard.newValue) ? changes.clipboard.newValue : [];
      render();
    }
  });

  initialize();
})();
