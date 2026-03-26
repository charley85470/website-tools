# Website Memo & Border Toolbox

Chrome Extension（Manifest V3）

## 功能

- 為網站新增可拖曳 Memo（可關閉，重新進入頁面會再顯示）
  - Memo 顏色可自訂
  - 拖曳後的位置會自動儲存，下次進入頁面維持上次位置
- 為網站加上四邊 Border（點擊關閉按鈕可暫時隱藏 5 分鐘，時間到後自動恢復）
- Border 可設定上下左右四個位置的說明文字
- Border 顏色支援快速色票（紅橙黃綠藍靛紫）與自訂選色
- Border 邊框寬度可調整（1–20px）
- Border 邊框線可單獨顯示或隱藏（隱藏時僅保留文字標籤）
- 滑鼠旁 Banner：游標移動時旁邊顯示 Border 標籤文字，可開關
- Border 作用規則：
  - 同一作用路徑（domain / parent / page + scopeValue）僅保留一筆設定
  - 同頁同時命中多種作用域時，優先順序為 `page > parent > domain`
- 作用域支援：
  - domain 下所有頁面
  - 同父目錄下所有頁面（可自行編輯路徑）
  - 僅該頁面
- 支援 SPA 路由偵測：監聽 `history.pushState` / `replaceState` 及 `popstate`，頁面切換時自動重新渲染
- 提供完整設定頁：
  - 顯示該網域下所有設定
  - 使用頁籤切換 Memo / Border
  - 單筆編輯與刪除
- 匯出/匯入設定（JSON 備份）
  - 匯出目前所有設定為 JSON
  - 匯入 JSON 還原設定（可使用本擴充匯出的備份檔）

## 安裝方式（開發模式）

1. 開啟 Chrome，前往 `chrome://extensions`
2. 啟用右上角「開發人員模式」
3. 點選「載入未封裝項目」
4. 選擇本專案資料夾

## 使用方式

1. 打開任一網站
2. 點擊擴充功能圖示開啟小視窗
3. 切換 `Memo` 或 `Border`
4. 選擇作用域
5. 填入內容並新增
6. 如需管理既有設定，點「開啟完整設定視窗」
7. 在完整設定頁可使用「匯出 JSON / 匯入 JSON」做備份與還原

## 資料儲存

- 使用 `chrome.storage.local`
- 所有設定儲存在 `entries` 陣列
