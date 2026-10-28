# 影像隱私護罩 L1 個人版（照片）

這是沿用 `current-photo-app/` 的 L1 個人版靜態本機網頁 App。它只處理**單張照片**，不含影片功能；沒有帳號、後端 API、遙測、雲端上傳或照片持久快取。

## 開啟

請以本機 HTTP 伺服器開啟，不要直接雙擊 `dist/index.html`：

```bash
cd l1-personal-photo-app
npm start
```

開啟 <http://127.0.0.1:8080>。若 8080 已被其他服務使用，可改用：

```bash
python3 -m http.server 8081 --directory dist
```

再開啟 <http://127.0.0.1:8081>。

## 在自己的 iPhone 完全離線測試

若要不依賴 Mac 持續執行，也不靠 Wi-Fi 或區網提供網頁，請使用 [`ios/README.md`](ios/README.md) 的 Xcode 專案。它把同一份 `dist/` 網頁、MediaPipe WASM 與模型包進 App；安裝完成後，iPhone 可在飛航模式開啟及處理照片。

以免費 Apple Account 即可簽署並安裝到自己的 iPhone；付費 Apple Developer Program 只在要用 TestFlight 或 App Store 發布時才需要。此專案已完成 iOS 編譯，並在一支實體 iPhone 確認能啟動、匯入和載入離線模型，且曾找到一張人臉並套用馬賽克；匯出、JSON、重複換圖穩定性及新的 1.1.3 偵測改善仍須依 iPhone 驗收步驟確認。

為避免自訂離線網址在 iOS WebKit 中沒有 Web Crypto 權限而無法產出證據報告，版本 `1.1.1` 在 Web Crypto 不可用時改用內建 SHA-256 計算備援；它只用於相同的本機摘要，不會傳送照片或改變偵測／遮蔽結果。

## 功能與使用方式

1. 匯入 JPEG、PNG 或 WebP；檔案只在目前瀏覽器的工作記憶體解碼。
2. 內附的 MediaPipe BlazeFace 模型在本機 CPU/WASM 偵測人臉。每張偵測臉都能選「保留」或「遮蔽」。

   版本 `1.1.4` 對整張圖未命中時，會在本機以四個重疊區塊再掃描一次，以改善網頁截圖或版面中的較小人像；門檻也由 50% 降為 35%。這可能帶來誤報，請在輸出前逐一確認偵測框，並以「保留」排除不是人臉的框。一般檢視時可用單指滑動照片；只有按下「手動新增遮蔽範圍」才會切換為拖曳框選。
3. 選擇馬賽克、不透明色塊或 Emoji，並可調整遮蔽邊界。按「手動新增遮蔽範圍」後，在照片上拖曳補框；手動範圍可保留、遮蔽或移除。
4. 選 JPEG 或 PNG，按「下載並重新載入驗證」。輸出由乾淨畫布重新編碼，因此不含原檔 EXIF；App 會重新載入輸出，掃描 JPEG APP1 Exif 或 PNG `eXIf`，並對每一個指定遮蔽區做像素檢查。在 iPhone App 中，驗證完成的照片會要求「新增照片」權限，成功後存入「照片」App 的「最近項目」；不會留在 App 的檔案資料夾。
5. 驗證完成後可下載本機 JSON 證據報告。iPhone App 將它存入「檔案」App >「瀏覽」>「在我的 iPhone」>「影像隱私護罩」。報告含輸入／輸出 SHA-256、模型與軟體版本、照片處理數、偵測／手動區數、每區驗證結果與 EXIF 結果；不含影像位元組、縮圖或內嵌照片。

## 驗證狀態的意義

`passed` 表示匯出檔可重新解碼、尺寸相符、未找到 EXIF 標記，且所有指定遮蔽區符合目前樣式的像素規則。色塊會檢查顏色覆蓋率；馬賽克會檢查變更涵蓋率與平均色差；Emoji 會檢查畫面變更。`needs_review` 代表輸出仍會下載，但其中一項自動檢查未通過或無法完成。

這不是「所有臉都已遮蔽」的保證。側臉、極小人臉、遮擋、照片外的身分資訊，以及 Emoji／馬賽克在特定情境的去識別強度，都需要人工檢視。

## 記憶體與資料生命週期

- 照片像素、偵測／手動框、雜湊與證據報告只在頁面工作階段記憶體存在；不寫入 LocalStorage、IndexedDB、Cache Storage 或伺服器。
- iPhone 大於 800 萬像素的照片會在匯入後縮小為最多約 800 萬像素再偵測、預覽與輸出，以控制本機畫布記憶體。JSON 報告同時記錄原始尺寸與實際處理尺寸；輸出尺寸會是處理尺寸，不是原圖尺寸。
- 「換一張照片」與「清除工作階段資料」會清空這些 App 參照並重設畫布；模型資源可留在記憶體，以便下一張照片使用。
- JavaScript、瀏覽器或作業系統的底層記憶體不可能由本 App 保證安全抹除，故不應宣稱已完成安全清除。

## 授權與邊界

此 L1 版沒有納入 Jason Tools 或任何 AGPL 程式碼。隨附 MediaPipe Tasks Vision 0.10.32、WASM 與 BlazeFace short-range 模型的來源／告知請見 `THIRD_PARTY_NOTICES.md`、`THIRD_PARTY_MEDIAPIPE_PACKAGE.json` 與 `THIRD_PARTY_MEDIAPIPE_README.md`。對外散布前仍應確認肖像、個資、組織政策與上游模型條款。

本專案程式碼以 Apache-2.0 授權釋出；第三方元件、模型與素材仍依各自條款使用，詳見上述告知文件。

## Author / 作者

Maintained by [Hai-kuang (Ryan) Lin](https://github.com/haikuang-lin).

Hai-kuang (Ryan) Lin brings nearly three decades of global technology industry leadership spanning the complete value chain—from semiconductor design and silicon intellectual property licensing (NXP, DTS/Xperi) to enterprise servers and systems integration (Sun Microsystems, HP, Compaq, Siemens), industrial automation, and automotive electronics (Advantech, First International Computer). He has served as Greater China and Southeast Asia General Manager and Senior ODM Product Director for global technology leaders.

Currently serving as Chief Information Security Officer for the Taiwan Personal Data Protection Promotion Association, Mr. Lin advises major public and private sector enterprises on privacy, cybersecurity, and artificial intelligence governance. His strategic engagements include:

- Advising on banking core systems supply chain security for formal legislative inquiries before financial regulators.
- Engaging in direct technical dialogues with U.S. FDA medical device cybersecurity leadership regarding Section 524B compliance and Software Bill of Materials (SBOM).
- Assisting public agencies and private sector enterprises in achieving national and international privacy trust certifications.

### Academic Background & Professional Certifications

- MBA in Computer Methodology, Baruch College, City University of New York (GMAT Quantitative score in the Top 1% worldwide)
- B.S. in Computer Science and Information Engineering, Tamkang University
- ISO/IEC 42001:2023 (Artificial Intelligence Management System) Lead Auditor (SGS)
- ISO/IEC 27701:2025 (Privacy Information Management System) Lead Auditor (SGS)
- ISO/IEC 27001:2022 (Information Security Management System) International Lead Auditor
- Certified Privacy Protection Professional (CPPP), TPIPAS
- Professional Certifications in Nvidia Generative AI and Google Cybersecurity

本專案聚焦可實際使用的本機優先照片隱私保護：人臉候選偵測、人工覆核與可匯出的遮蔽結果，不將照片送往服務端。

## 測試紀錄

請讀 [TEST_REPORT.md](TEST_REPORT.md)。它區分本次已實跑的本機瀏覽器測試、iOS 編譯檢查與尚未完成的 Windows、iOS／Android 實機、Safari、實機觸控拖曳、多臉／側臉等測試。
