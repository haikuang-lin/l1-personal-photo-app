# iPhone 離線測試包

`PrivacyShieldL1.xcodeproj` 將 L1 的 `dist/` 複製到 App bundle 的 `WebApp/` 內。App 只在自己的 `127.0.0.1` loopback 位址提供這些內建檔案，讓 WebKit／MediaPipe 使用標準 HTTP 載入 WASM 與模型；它不需要 Wi-Fi、Mac、網際網路或外部伺服器，也不接受任何照片上傳。

## 以免費 Apple 帳號安裝到自己的 iPhone

1. 在 Mac 開啟 `PrivacyShieldL1.xcodeproj`。
2. 用 USB 連接已解鎖的 iPhone，並在 iPhone 信任此 Mac。
3. Xcode 左上方選你的 iPhone；選 Target **PrivacyShieldL1** → **Signing & Capabilities**。
4. 在 **Team** 選自己的免費 Apple Account。若 Xcode 指出 Bundle Identifier 衝突，將 `com.local.privacyshieldl1` 改成自己的唯一字串，例如 `com.你的英文名字.privacyshield`。
5. 按 Run。首次可能要求 iPhone 設定中信任開發者；依 Xcode 畫面提示完成。若出現「Developer Mode 未開啟」，到「設定」→「隱私權與安全性」→「開發者模式」開啟，依手機提示重新啟動後再按 Run。

免費帳號適合在自己的裝置測試，不包含 TestFlight 或 App Store 對外發佈。簽署／佈署限制由 Apple 帳號與 Xcode 顯示為準。

## 驗收重點

- 開啟 App 前後皆可開啟飛航模式；App 首頁應正常顯示。
- 從照片選擇器選一張測試照，確認偵測、遮蔽與 JPEG／PNG 匯出。
- 驗證完成的 JPEG／PNG 照片應要求「新增照片」權限並存入「照片」App 的「最近項目」；JSON 證據報告應出現在「檔案」App >「在我的 iPhone」>「影像隱私護罩」。
- 已有一次實機成功載入離線模型、找到一張臉並套用馬賽克的紀錄；但目前版本的偵測、重複換圖、匯出與上述儲存位置尚未完成完整實機回歸，必須以你的裝置驗收後才可宣稱可用。
