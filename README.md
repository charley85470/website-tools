# Website Tools

Chrome Extension（Manifest V3）

## 功能

### Clipboard（全域剪貼簿）
- 儲存常用文字片段，隨時快速複製
- 可手動輸入新增；亦可在網頁上選取文字後按右鍵 → 「儲存選取文字至剪貼簿」快速儲存
- 不限網域，所有頁面均可使用
- 支援刪除單筆或清除全部

### Memo
- 為網站新增可拖曳 Memo（可關閉，重新進入頁面會再顯示）
  - Memo 顏色可自訂
  - 拖曳後的位置會自動儲存
- 僅在一般 HTTP/HTTPS 網頁可用

### Border
- 為網站加上四邊 Border（點擊關閉按鈕可暫時隱藏 5 分鐘，時間到後自動恢復）
- Border 可設定上下左右四個位置的說明文字
- Border 顏色支援快速色票（紅橙黃綠藍靛紫）與自訂選色
- Border 邊框寬度可調整（1–20px）
- Border 邊框線可單獨顯示或隱藏（隱藏時僅保留文字標籤）
- 滑鼠旁 Banner：游標移動時旁邊顯示 Border 標籤文字，可開關
- 僅在一般 HTTP/HTTPS 網頁可用

### 作用域（Memo / Border）
- 支援三種作用域：
  - domain 下所有頁面
  - 同子目錄下所有頁面（可自行編輯路徑）
  - 僅該頁面
- 作用規則：同一作用路徑僅保留一筆設定；同頁命中多種作用域時，優先順序為 `page > 子目錄 > domain`
- 支援 SPA 路由偵測：監聽 `history.pushState` / `replaceState` 及 `popstate`，頁面切換時自動重新渲染

### 完整設定頁
- 使用頁籤切換 Clipboard / Memo / Border
- 單筆編輯（Memo/Border）與刪除
- 匯出/匯入 JSON 備份，涵蓋 Clipboard、Memo、Border 全部資料

## 安裝方式（開發模式）

1. 開啟 Chrome，前往 `chrome://extensions`
2. 啟用右上角「開發人員模式」
3. 點選「載入未封裝項目」
4. 選擇本專案的 `app/` 資料夾

## 使用方式

1. 點擊擴充功能圖示開啟小視窗（預設顯示 Clipboard）
2. **Clipboard**：輸入文字新增片段，或在網頁右鍵儲存選取文字；點擊複製或刪除按鈕操作各筆
3. **Memo / Border**：切換至對應頁籤，選擇作用域，填入內容後新增（需在一般網頁才能使用）
4. 如需管理既有設定，點「開啟完整設定視窗」
5. 在完整設定頁可使用「匯出 JSON / 匯入 JSON」做備份與還原

## 資料儲存

- 使用 `chrome.storage.local`
- Memo / Border 設定儲存在 `entries` 陣列
- Clipboard 片段儲存在 `clipboard` 陣列
