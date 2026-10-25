# 旅途手帳

手機優先的 GitHub Pages 旅程 dashboard。公開目錄 `site/` 只包含靜態程式與加密旅程資料，不需要建置工具或外部 CDN。

## 安全方式

密碼透過 PBKDF2-SHA256（600,000次、隨機salt）衍生 AES-256-GCM 金鑰，在瀏覽器本機解密。密碼、原始票券與明文旅程不納入此儲存庫。這是靜態網站的密碼加密解鎖，不是伺服器登入；公開密文仍可被下載嘗試猜密碼，請保留自動產生的強密碼。

解鎖後資料只放在頁面記憶體，不存localStorage；僅清單勾選狀態存於本機。閒置10分鐘或離開頁面會鎖定。離線快取只包含程式與密文，不快取密碼及明文。鎖定不會清除已複製至剪貼簿的資訊。請避免在公共裝置開啟。

## 本機查看

```sh
python3 -m http.server 8000 --directory site
```

以瀏覽器開啟本機8000埠；正式部署需HTTPS，供Web Crypto及Service Worker運作。首次線上載入並完成快取後可離線解鎖；地圖、電話及外部議程依裝置或網路條件運作。

## GitHub Pages 發布

1. 將此儲存庫內容推送至 `swguo/IPMC` 的 `main`。
2. GitHub 儲存庫 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 確認 `Deploy travel dashboard` 工作流程成功；必要時至 Actions 手動執行。
4. 預期專案網址為 `https://swguo.github.io/IPMC/`，僅在部署成功後可用。

Actions僅上傳 `site/`。不要將原始PDF、明文筆記、密碼或私密資料加入Git。也可在Pages設定使用 `main` 根目錄以外的自訂來源前，先採本專案的Actions部署方式。

## 更新資料／密碼

私密HTML與密碼檔放在checkout外，對該檔案採僅本人可讀權限。編輯私密HTML後執行：

```sh
node scripts/encrypt.mjs /private/content.html /private/dashboard.password
node tests/validate.mjs
```

加密工具要求至少16字元密碼，完整密碼由私密檔讀取，不應放命令列。HTML會在解鎖後作為可信模板呈現，只可加入可信內容，外部文件文字需先HTML escape。更新發布時請同時遞增 `site/sw.js` 的快取版本。更換密碼後舊版密文及舊密碼仍可能存在Git歷史或其他裝置的離線快取；改密碼無法撤回曾經公開的版本。

## 驗證

`node tests/validate.mjs` 檢查公開資產範圍、密文格式與個資未明文外洩。本次另以真實瀏覽器驗證錯誤密碼、正確解鎖、日期切換、清單保留、手機版、複製、手動鎖定、自動鎖定及離線解鎖。
