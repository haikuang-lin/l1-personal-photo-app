# L1 人臉隱私遮蔽：20 張公開影像第一輪基線結果

測試日期：2026-11-05  
測試版本：公開儲存庫工作樹的 `dist/`；MediaPipe FaceDetector /
`blaze_face_short_range.tflite`、CPU/WASM；偵測門檻 `0.35`。  
測試方式：以本機 HTTP 伺服器開啟 App，逐張匯入 JPEG，讀取 UI 顯示的候選框數與
信心分數。照片只交給 `127.0.0.1` 的本機 App；沒有把測試照片提交到此儲存庫。

## 先說結論

這是 **20 張分層探索基線**，不是統計隨機抽樣或模型準確率證明。已完成的項目是
20/20 自動候選偵測；尚未完成盲式人工標註，所以不能計算 TP、FP、FN、IoU 或召回率。

但已經有足夠的可重現失敗訊號，不能宣稱「自動遮蔽可靠」：

- `B02`（檔名明示為一對人物）得到 0 框；`B03`、`B04` 的多人照片都只得到 1 框。
- `C05`（人臉老化示意）得到 0 框，屬於已觀察到的困難／非照片式臉部漏檢。
- `D02`（人體藝術／怪誕臉繪圖）得到 2 框，`D03`（建築）得到 2 框；這是明確的非真人
  誤報訊號。
- 因此目前產品必須維持「全部遮蔽／保留」逐框控制、手動新增遮蔽範圍和匯出前人工覆核；
  不能以此輪結果宣稱零漏檢。

## 20 張自動偵測紀錄

「UI 框／信心」是 App 畫面所示，不是人工真值。`—` 表示沒有候選框。

| 案例 | 組別 | UI 框／信心 | UI 結果 | 觀察 |
|---|---|---|---|---|
| A01 | 清楚單臉 | 2 / 94%, 45% | 找到 2 張人臉 | 額外低信心候選，待人工判定是否誤報。 |
| A02 | 清楚單臉 | 1 / 95% | 找到 1 張人臉 | 待人工標註。 |
| A03 | 清楚單臉 | 1 / 82% | 找到 1 張人臉 | 待人工標註。 |
| A04 | 清楚單臉 | 1 / 52% | 找到 1 張人臉 | 低於 0.60 的候選，待人工標註。 |
| A05 | 清楚單臉 | 1 / 51% | 找到 1 張人臉 | 低於 0.60 的候選，待人工標註。 |
| B01 | 多人臉 | 2 / 68%, 56% | 找到 2 張人臉 | 待人工逐臉比對。 |
| B02 | 多人臉 | — | 未找到人臉 | 檔名為 young pair；優先列入多人／歷史照片漏檢回歸集。 |
| B03 | 多人臉 | 1 / 37% | 找到 1 張人臉 | 檔名為 four girls；疑似多人漏檢，待人工確認。 |
| B04 | 多人臉 | 1 / 46% | 找到 1 張人臉 | 慶祝人群照，需以人工標註判定漏檢數。 |
| C01 | 困難情境 | 1 / 66% | 找到 1 張人臉 | 剪影照；待人工判定框位置。 |
| C02 | 困難情境 | 1 / 92% | 找到 1 張人臉 | 官方肖像；待人工標註。 |
| C03 | 困難情境 | 1 / 63% | 找到 1 張人臉 | 歷史影像；待人工標註。 |
| C04 | 困難情境 | 1 / 70% | 找到 1 張人臉 | 舞台／樂手照；待人工標註。 |
| C05 | 困難情境 | — | 未找到人臉 | 人臉老化示意圖漏檢；不能依賴自動偵測。 |
| D01 | 非真人／無臉 | — | 未找到人臉 | 預期為無真人臉類型；待人工確認。 |
| D02 | 非真人／繪圖 | 2 / 35%, 76% | 找到 2 張人臉 | 怪誕臉線畫；非真人誤報的強訊號。 |
| D03 | 非真人／建築 | 2 / 53%, 36% | 找到 2 張人臉 | 建築物；非人臉誤報的強訊號。 |
| E01 | 困難光線／壓縮 | 2 / 66%, 49% | 找到 2 張人臉 | 待人工標註。 |
| E02 | 困難光線／壓縮 | 1 / 85% | 找到 1 張人臉 | 待人工標註。 |
| E03 | 困難光線／壓縮 | 4 / 74%, 62%, 53%, 52% | 找到 4 張人臉 | 待人工逐框比對。 |

## 匯出驗證：實測範圍與限制

`E03` 已實際操作一次 JPEG 與一次 PNG 的「下載並重新載入驗證」。兩次 UI 都回報：
`匯出完成，驗證需要複核`。這只能證明瀏覽器取得了兩個輸出檔，**不能**證明像素遮蔽、
重載、尺寸或 EXIF 已通過。其餘 19 張及完整 40 次雙格式驗證尚未進行。

| 項目 | 已測 | 結論 |
|---|---:|---|
| 自動候選偵測 | 20/20 | 完成；不可換算為召回率。 |
| JPEG 匯出按鈕 | 1/20 | 建立檔案，但 App 要求人工複核。 |
| PNG 匯出按鈕 | 1/20 | 建立檔案，但 App 要求人工複核。 |
| 輸出像素、重載、EXIF | 0/40 | 未驗證；不得標記通過。 |
| 漏檢後手動補框與人工視覺覆核 | 0/20 | 未驗證；下一輪必做。 |
| 本機網路請求稽核 | 0/20 | 未以開發者工具留存證據；待測。 |

## 建議的改善順序

1. **先做 20 張固定回歸集的人工標註。** 以兩位覆核者先標臉、再看模型結果，記錄每框
   IoU、TP、FP、FN。這是取得真正 recall/precision 的前提，不可直接用本表的 UI 框數。
2. **分開校正全圖與分區掃描的門檻。** `D02`、`D03` 已有誤報，而 `B02` 又是 0 框；只把
   目前 `0.35` 一律降低，很可能增加繪圖／建築誤報。每次只改一個參數，重跑固定集。
3. **對多人與小臉新增第二階段掃描。** 不改預設自動匯出邏輯；先以更密的重疊分區或較高
   解析度二次掃描做 A/B 測試，重點追蹤 `B02–B04` 的逐臉召回及 D 組誤報數。
4. **把人工覆核做成主流程，而不是備援說明。** 對「0 框」、「低於 0.60」及多人影像顯示
   明確警示；提供放大檢視、手動框和匯出前「已逐臉確認」勾選。這是修模型前立即可降低
   漏遮蔽風險的措施。
5. **修正或明確降級匯出驗證。** 現在 UI 已如實提示「需要複核」。下一步應將 JPEG/PNG
   的輸出重載、尺寸、遮蔽區像素與 EXIF 結果寫入本機 JSON；未完成前 README 不應宣稱
   兩格式自動驗證通過。

## 可重取來源與雜湊

樣本為公開可重取的 Wikimedia Commons 檔案；本次是依情境分層的工程樣本，沒有宣稱為
真正隨機母體抽樣。未把影像放入儲存庫。以下列出來源頁、授權與下載後 SHA-256，供日後
重取或偵測來源變更。

| 案例 | Commons 檔案頁 | 授權 | SHA-256 |
|---|---|---|---|
| A01 | [Miss Korea](https://commons.wikimedia.org/wiki/File:2019_%EB%AF%B8%EC%8A%A4%EC%BD%94%EB%A6%AC%EC%95%84_%EA%B9%80%EB%8B%A8%EC%95%84.jpg) | CC BY-SA 4.0 | `b4520caeb29f4777a2ab7c7ea523033652579d33288fe993239d2f67dfd5a04c` |
| A02 | [Prof Akif](https://commons.wikimedia.org/wiki/File:1765368734.Prof_Akif_Ba%C4%9F%C4%B1rov.jpg) | CC0 | `a27ac17e6e60b9545af56371309f3b5bc2531ae7dd7c30332daf2337e2e439e8` |
| A03 | [Young Iranian man](https://commons.wikimedia.org/wiki/File:%22A_young_Iranian_man_with_long_hair%22_01.jpg) | CC BY-SA 4.0 | `423833c11565db901090874d25347aa5da836047f4903fc7b5ab7403f8114794` |
| A04 | [Bass guitarist](https://commons.wikimedia.org/wiki/File:%22A_bass_guitar_player_in_nature_-_Iranian_bassist_-_Performer_Aydin_Karbalaei-_Photographer_Mostafa_Meraji_%D9%80_Alamut_Mountains_in_Iran%22_03.jpg) | CC BY-SA 4.0 | `fdaaa9d8d277c6bdfd55f2c2ee7e4fb953fd4141508f3ce4379e2fd5fed9c2a6` |
| A05 | [Phebe Coffin](https://commons.wikimedia.org/wiki/File:(Portrait_of_Phebe_M._Coffin)_(LOC)_(38899516010).jpg) | no known restrictions | `e6531497de786a5fc820cde4c669f79046860e89e1bd0a81152cab13803b6336` |
| B01 | [Andersen couple](https://commons.wikimedia.org/wiki/File:1884_G._Andersen_Pair_Portrait_Photographs_Couple.jpg) | CC BY-SA 4.0 | `18044419e8c7504537c6d458f933e4decd6bc8721b364461fce13a36ba22b351` |
| B02 | [Young pair](https://commons.wikimedia.org/wiki/File:P_Sinner_-_Schw%C3%A4bische_Volkstrachten_Betzingen._Junges_Paar_am_Dorfbrunnen_(Sammelbild_CdV_1870er).jpg) | public domain | `fe2c9ec20821641e8a6a709bad398838acc06b685daaec0784347fbeb880b71c` |
| B03 | [Four girls](https://commons.wikimedia.org/wiki/File:Vier_M%C3%A4dchen_in_Betzinger_Tracht_vor_Kusterdinger_Kirche_(AK_327_P_Sinner).jpg) | public domain | `886019b37de65e79859a17cda7285bc938f5f04581b1f9b2863d85fc927feba7` |
| B04 | [Washington celebration](https://commons.wikimedia.org/wiki/File:2020.11.07_Celebrating,_Washington,_DC_USA_312_150318_(50578017142).jpg) | CC BY-SA 2.0 | `6d568e2e95403b5fbde7d37de5b74f9900530ba4329c51839b7622d749d3b98c` |
| C01 | [Silhouette](https://commons.wikimedia.org/wiki/File:%22Silhouette_image_of_a_young_Iranian_man%22_07.jpg) | CC BY-SA 4.0 | `1dd4a4291a1ad1d63864340de6d689a434b1871d9b69b35d4f38c44d9660f361` |
| C02 | [Obama portrait](https://commons.wikimedia.org/wiki/File:President_Barack_Obama.jpg) | public domain (US federal government) | `2391017375f6ac2b320228a4ccd54dda7dc4287f5aa92aa9477e31f2c8c73199` |
| C03 | [Son of Lapland](https://commons.wikimedia.org/wiki/File:%22The_son_of_Lapland%22_1970_(HK7155-10069).tif) | CC BY 4.0 | `0b3d790253a7df185200a39fbf9c5c15a25fd79b4e2c3a2f1ca274fd131d40f2` |
| C04 | [Lead guitar player](https://commons.wikimedia.org/wiki/File:%22A_lead_electronic_guitar_player_in_the_Iranian_band_Mortaz-_Artist_Amirmahdi_Tavakol%22_35.jpg) | CC BY-SA 4.0 | `f043ce93a85c8789f6f4a02dc1726fb1dcf01b50166974e6f468fab785e8b340` |
| C05 | [Ageing human face](https://commons.wikimedia.org/wiki/File:Ageing_of_the_human_face.jpg) | CC BY-SA 3.0 | `6a21d4cb19da7cd40afdbf644de09ea60814501fc833daa742a9645f98393397` |
| D01 | [Ancient Meitei character](https://commons.wikimedia.org/wiki/File:Ancient_Meitei_character_%22LAI%22_(%EA%AF%82)_represents_as_well_as_means_%22forehead%22.jpg) | CC0 | `65aa1141327754ad245466f0a1e5fd939e78d59ffbf67d79852166dbb9a0737c` |
| D02 | [Grotesque drawing](https://commons.wikimedia.org/wiki/File:A_character_with_a_grotesque_face._Line_Wellcome_V0007459.jpg) | CC BY 4.0 | `8f1af5d3f9567bc420d4f746a80da59f502053a54acd47393b5fe3068c18f80f` |
| D03 | [Scharinska Villa](https://commons.wikimedia.org/wiki/File:16001000424095-Scharinska_villan-Riksantikvarie%C3%A4mbetet.jpg) | CC BY 3.0 | `8fc44082b55f8e7d54301b9be2d34f4bc1a0309cf1053d2fbe40cca7c2ec4107` |
| E01 | [Dreaming Heidi](https://commons.wikimedia.org/wiki/File:%22Dreaming_Heidi%22_(HK7155-10001).tif) | CC BY 4.0 | `b5f1a78d6dd47b3e846860507f44d69f4e39a7036cc5b15d2efcd19844a08185` |
| E02 | [Mikko merellä](https://commons.wikimedia.org/wiki/File:%22Mikko_merell%C3%A4%22_(HK7155-10003).tif) | CC BY 4.0 | `7738b61f2680aa5a5eaf511a7520a476709b001834b7d74799ce59642b1b7a48` |
| E03 | [Nebraskans](https://commons.wikimedia.org/wiki/File:%22Nebraskans,%22_1854-1904,_p._59.jpg) | public domain | `2812d42d0dc747ff530447c2ceeba325ea7c09b93b2cc3389e09dc8ca1290d61` |

## 下一輪的通過條件

完成兩位人工標註者的真值、每張 JPEG/PNG 匯出與獨立像素／EXIF 檢查後，才依
`TEST_PROTOCOL_20.md` 的門檻判定是否通過。若未達標，保留本報告中的失敗案例作為
固定回歸集，不能以更換測試圖來掩蓋退步。
