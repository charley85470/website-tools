// background.js — 右鍵選單儲存文字至剪貼簿 + badge 通知

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveTextClipboard',
    title: '儲存選取文字至剪貼簿',
    contexts: ['selection']
  });
});

let _badgeTimer = null;
function setTemporaryBadge(text, color = '#2563eb', duration = 1500) {
  try {
    chrome.action.setBadgeText({ text: String(text) });
    chrome.action.setBadgeBackgroundColor({ color });
    if (_badgeTimer) clearTimeout(_badgeTimer);
    _badgeTimer = setTimeout(() => {
      try { chrome.action.setBadgeText({ text: '' }); } catch (_) {}
      _badgeTimer = null;
    }, duration);
  } catch (_) {}
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'saveTextClipboard') return;
  const text = (info.selectionText || '').trim();
  if (!text) return;

  chrome.storage.local.get({ clipboard: [] }, (data) => {
    const items = data.clipboard || [];
    if (items.includes(text)) {
      setTemporaryBadge('✓');
      return;
    }
    const updated = [text, ...items];
    chrome.storage.local.set({ clipboard: updated }, () => {
      setTemporaryBadge('+');
    });
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === 'notify' && msg.showBadge !== false) {
    setTemporaryBadge('•');
  }
});
