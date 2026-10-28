import { FaceDetector, FilesetResolver } from "./vendor/mediapipe/vision_bundle.mjs";

const APP_VERSION = "1.1.4-l1-personal";
const MODEL_VERSION = "MediaPipe FaceDetector / BlazeFace short range (bundled TFLite)";
const MAX_PROCESSING_PIXELS = 8_000_000;
const $ = (id) => document.getElementById(id);
const canvas = $("photoCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const sourceCanvas = document.createElement("canvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const state = { image: null, imageName: "照片", originalHash: null, sourceMime: null, sourceByteLength: 0, inputDimensions: null, regions: [], detector: null, report: null, importCount: 0, manualMode: false, manualDraft: null };
const els = { empty: $("emptyState"), editor: $("editor"), file: $("fileInput"), status: $("detectionStatus"), imageName: $("imageName"), regionList: $("regionList"), noRegions: $("noRegions"), emoji: $("emojiSelect"), blockColor: $("blockColor"), padding: $("paddingRange"), paddingOut: $("paddingOutput"), format: $("formatSelect"), quality: $("qualityRange"), qualityOut: $("qualityOutput"), qualityRow: $("jpegQualityRow"), manual: $("manualMaskButton"), clear: $("clearSessionButton"), report: $("reportButton"), verification: $("verificationStatus") };

function chosenMode() { return document.querySelector('input[name="mode"]:checked').value; }
function currentStyle() { return { mode: chosenMode(), emoji: els.emoji.value, blockColor: els.blockColor.value, paddingPercent: Number(els.padding.value) }; }
function nextId(prefix) { return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`; }
function clampBox(box) { const x = Math.max(0, Math.min(canvas.width, box.x)), y = Math.max(0, Math.min(canvas.height, box.y)), right = Math.max(x, Math.min(canvas.width, box.x + box.width)), bottom = Math.max(y, Math.min(canvas.height, box.y + box.height)); return { x, y, width: right - x, height: bottom - y }; }
function paddedBox(box, paddingPercent = Number(els.padding.value)) { const extra = Math.max(box.width, box.height) * paddingPercent / 100; return clampBox({ x: box.x - extra, y: box.y - extra, width: box.width + extra * 2, height: box.height + extra * 2 }); }
function regionBox(region, style = currentStyle()) { return paddedBox(region.box, style.paddingPercent); }
function drawGuidance(target, box, color) { target.save(); target.strokeStyle = color; target.lineWidth = Math.max(2, canvas.width / 700); target.setLineDash([7, 5]); target.strokeRect(box.x, box.y, box.width, box.height); target.restore(); }
function drawMaskTo(target, readCanvas, box, style) {
  if (box.width < 1 || box.height < 1) return;
  if (style.mode === "block") { target.fillStyle = style.blockColor; target.fillRect(box.x, box.y, box.width, box.height); return; }
  if (style.mode === "emoji") { const size = Math.max(box.width, box.height) * 1.06; target.save(); target.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; target.textAlign = "center"; target.textBaseline = "middle"; target.fillText(style.emoji, box.x + box.width / 2, box.y + box.height / 2); target.restore(); return; }
  const size = Math.max(8, Math.round(Math.max(box.width, box.height) / 12)), x = Math.floor(box.x), y = Math.floor(box.y), w = Math.ceil(box.width), h = Math.ceil(box.height), small = document.createElement("canvas");
  small.width = Math.max(1, Math.ceil(w / size)); small.height = Math.max(1, Math.ceil(h / size));
  small.getContext("2d").drawImage(readCanvas, x, y, w, h, 0, 0, small.width, small.height);
  target.save(); target.imageSmoothingEnabled = false; target.drawImage(small, 0, 0, small.width, small.height, x, y, w, h); target.restore(); small.width = 1; small.height = 1;
}
function draw() { if (!state.image) return; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(sourceCanvas, 0, 0); const style = currentStyle(); for (const region of state.regions) { const box = regionBox(region, style); if (region.action === "mask") drawMaskTo(ctx, sourceCanvas, box, style); else drawGuidance(ctx, box, "#61e5c0"); } if (state.manualDraft) drawGuidance(ctx, state.manualDraft, "#ffd166"); }
function sha256Fallback(bytes) {
  // Custom WKWebView schemes may not be a secure context, so Web Crypto can be unavailable.
  // This fallback is local, deterministic, and used only for the evidence-report digest.
  const constants = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const bitLength = bytes.length * 8, paddedLength = Math.ceil((bytes.length + 9) / 64) * 64, data = new Uint8Array(paddedLength), view = new DataView(data.buffer), words = new Uint32Array(64);
  data.set(bytes); data[bytes.length] = 0x80; view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000)); view.setUint32(paddedLength - 4, bitLength >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) { const a = words[i - 15], b = words[i - 2], s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10); words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0; }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i += 1) { const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), choice = (e & f) ^ (~e & g), temp1 = (h + s1 + choice + constants[i] + words[i]) >>> 0, s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), majority = (a & b) ^ (a & c) ^ (b & c), temp2 = (s0 + majority) >>> 0; h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0; }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((word) => word.toString(16).padStart(8, "0")).join("");
}
async function sha256(blob) { const bytes = new Uint8Array(await blob.arrayBuffer()); if (globalThis.crypto?.subtle) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); } return sha256Fallback(bytes); }
async function loadDetector() { if (state.detector) return state.detector; els.status.textContent = "載入離線偵測器…"; const vision = await FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm"); state.detector = await FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: "./models/blaze_face_short_range.tflite", delegate: "CPU" }, runningMode: "IMAGE", minDetectionConfidence: 0.35, minSuppressionThreshold: 0.35 }); return state.detector; }
function toFaceRegions(detections, offsetX = 0, offsetY = 0, scale = 1) { return detections.map((d) => ({ box: { x: offsetX + d.boundingBox.originX / scale, y: offsetY + d.boundingBox.originY / scale, width: d.boundingBox.width / scale, height: d.boundingBox.height / scale }, score: d.categories?.[0]?.score ?? 0 })); }
function overlap(a, b) { const left = Math.max(a.x, b.x), top = Math.max(a.y, b.y), right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height), shared = Math.max(0, right - left) * Math.max(0, bottom - top); return shared / Math.max(1, Math.min(a.width * a.height, b.width * b.height)); }
const yieldToInterface = () => new Promise((resolve) => setTimeout(resolve, 0));
async function detectFaces(detector) {
  const primary = toFaceRegions(detector.detect(sourceCanvas).detections);
  if (primary.length) return primary;
  // A face embedded in a browser screenshot can be too small for a whole-image pass.
  // Retry four overlapping crops locally; this runs only after the primary pass finds none.
  const sideW = Math.ceil(canvas.width * 0.62), sideH = Math.ceil(canvas.height * 0.62);
  const tiles = [{ x: 0, y: 0 }, { x: canvas.width - sideW, y: 0 }, { x: 0, y: canvas.height - sideH }, { x: canvas.width - sideW, y: canvas.height - sideH }];
  const recovered = [];
  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
    els.status.textContent = `找不到人臉，分區掃描中（${tileIndex + 1}/${tiles.length}）…`;
    await yieldToInterface();
    const position = tiles[tileIndex];
    const x = Math.max(0, position.x), y = Math.max(0, position.y), width = Math.min(sideW, canvas.width - x), height = Math.min(sideH, canvas.height - y), sourcePixels = width * height, scale = Math.min(1, Math.sqrt(1_000_000 / sourcePixels)), tile = document.createElement("canvas");
    tile.width = Math.max(1, Math.floor(width * scale)); tile.height = Math.max(1, Math.floor(height * scale));
    tile.getContext("2d", { willReadFrequently: true }).drawImage(sourceCanvas, x, y, width, height, 0, 0, tile.width, tile.height);
    for (const face of toFaceRegions(detector.detect(tile).detections, x, y, scale)) if (!recovered.some((candidate) => overlap(candidate.box, face.box) > 0.55)) recovered.push(face);
    tile.width = 1; tile.height = 1;
  }
  return recovered;
}
function releasePhotoMemory() { state.image = null; state.imageName = "照片"; state.originalHash = null; state.sourceMime = null; state.sourceByteLength = 0; state.inputDimensions = null; state.regions = []; state.report = null; state.manualDraft = null; state.manualMode = false; state.importCount = 0; sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height); sourceCanvas.width = 1; sourceCanvas.height = 1; ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.width = 1; canvas.height = 1; els.file.value = ""; els.report.disabled = true; els.verification.hidden = true; els.manual.classList.remove("active"); els.manual.setAttribute("aria-pressed", "false"); }
function resetToUpload() { releasePhotoMemory(); els.editor.hidden = true; els.empty.hidden = false; els.status.textContent = "準備中…"; }
function processingDimensions(width, height) { const pixels = width * height; if (pixels <= MAX_PROCESSING_PIXELS) return { width, height, reduced: false }; const scale = Math.sqrt(MAX_PROCESSING_PIXELS / pixels); return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), reduced: true }; }
function conciseError(error) { return String(error?.message || error || "未知錯誤").replace(/\s+/g, " ").slice(0, 180); }
async function importImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  releasePhotoMemory(); els.empty.hidden = true; els.editor.hidden = false; els.imageName.textContent = file.name; state.imageName = file.name; state.sourceMime = file.type; state.sourceByteLength = file.size; state.importCount += 1; els.status.textContent = "讀取照片與計算 SHA-256…";
  const url = URL.createObjectURL(file), image = new Image();
  try { await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; }); } catch { URL.revokeObjectURL(url); els.status.textContent = "照片無法讀取"; return; }
  URL.revokeObjectURL(url); state.inputDimensions = { width: image.naturalWidth, height: image.naturalHeight }; const dimensions = processingDimensions(image.naturalWidth, image.naturalHeight); canvas.width = dimensions.width; canvas.height = dimensions.height; sourceCanvas.width = dimensions.width; sourceCanvas.height = dimensions.height; sourceCtx.drawImage(image, 0, 0, dimensions.width, dimensions.height); state.image = { width: dimensions.width, height: dimensions.height }; image.src = "";
  try { state.originalHash = await sha256(file); } catch (error) { console.warn(error); }
  draw();
  try { const faces = await detectFaces(await loadDetector()); state.regions = faces.map((face, index) => ({ id: `face-${index + 1}`, type: "face", box: face.box, score: face.score, action: "mask" })); renderRegions(); draw(); const resizeNote = dimensions.reduced ? `；為避免記憶體閃退，已由 ${state.inputDimensions.width}×${state.inputDimensions.height} 縮小為 ${dimensions.width}×${dimensions.height}` : ""; els.status.textContent = state.regions.length ? `找到 ${state.regions.length} 張人臉${resizeNote}` : `未找到人臉；可手動新增遮蔽範圍${resizeNote}`; }
  catch (error) { console.error(error); state.regions = []; renderRegions(); const detail = conciseError(error); els.status.textContent = "離線模型無法載入；仍可手動遮蔽"; els.noRegions.hidden = false; els.noRegions.textContent = `模型載入失敗：${detail}`; }
}
function renderRegions() {
  els.regionList.replaceChildren(); els.noRegions.hidden = state.regions.length !== 0; if (!state.regions.length) els.noRegions.textContent = "尚未找到人臉。可手動新增遮蔽範圍。";
  for (const region of state.regions) { const node = $("regionTemplate").content.firstElementChild.cloneNode(true); node.classList.add(region.action === "mask" ? "masked" : "retained"); node.querySelector(".region-title").textContent = region.type === "face" ? `人臉 ${region.id.replace("face-", "")}` : "手動遮蔽範圍"; node.querySelector(".region-detail").textContent = region.type === "face" ? `偵測信心 ${Math.round(region.score * 100)}%` : `${Math.round(region.box.width)} × ${Math.round(region.box.height)} 像素`;
    const thumb = node.querySelector(".region-thumb"), tctx = thumb.getContext("2d"), b = region.box, side = Math.max(b.width, b.height), sx = Math.max(0, b.x - (side - b.width) / 2), sy = Math.max(0, b.y - (side - b.height) / 2); tctx.drawImage(sourceCanvas, sx, sy, side, side, 0, 0, thumb.width, thumb.height);
    node.querySelector(".keep-button").onclick = () => setAction(region.id, "keep"); node.querySelector(".mask-button").onclick = () => setAction(region.id, "mask"); const remove = node.querySelector(".remove-button"); if (region.type === "manual") remove.onclick = () => removeRegion(region.id); else remove.hidden = true; els.regionList.append(node); }
}
function invalidateReport() { state.report = null; els.report.disabled = true; els.verification.hidden = true; }
function setAction(id, action) { const region = state.regions.find((item) => item.id === id); if (!region) return; region.action = action; invalidateReport(); renderRegions(); draw(); }
function removeRegion(id) { state.regions = state.regions.filter((region) => region.id !== id); invalidateReport(); renderRegions(); draw(); }
function exportCanvas(style) { const output = document.createElement("canvas"); output.width = canvas.width; output.height = canvas.height; const outCtx = output.getContext("2d", { willReadFrequently: true }); outCtx.drawImage(sourceCanvas, 0, 0); for (const region of state.regions.filter((item) => item.action === "mask")) drawMaskTo(outCtx, sourceCanvas, regionBox(region, style), style); return output; }
function blobFromCanvas(output, type, quality) { return new Promise((resolve) => output.toBlob(resolve, type, quality)); }
function hexToRgb(hex) { const value = hex.replace("#", ""); return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)); }
function sampledRegionMetrics(original, exported, box, expectedMode, expectedColor) {
  const x0 = Math.max(0, Math.floor(box.x)), y0 = Math.max(0, Math.floor(box.y)), x1 = Math.min(original.canvas.width, Math.ceil(box.x + box.width)), y1 = Math.min(original.canvas.height, Math.ceil(box.y + box.height)), width = Math.max(1, x1 - x0), height = Math.max(1, y1 - y0), stride = Math.max(1, Math.ceil(Math.max(width, height) / 36));
  const before = original.getImageData(x0, y0, width, height).data, after = exported.getImageData(x0, y0, width, height).data, rgb = expectedMode === "block" ? hexToRgb(expectedColor) : null;
  let samples = 0, changed = 0, solid = 0, totalDistance = 0;
  for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride) { const i = (y * width + x) * 4, distance = Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]); totalDistance += distance; if (distance > 24) changed += 1; if (rgb && Math.abs(after[i] - rgb[0]) + Math.abs(after[i + 1] - rgb[1]) + Math.abs(after[i + 2] - rgb[2]) <= 72) solid += 1; samples += 1; }
  const changedFraction = samples ? changed / samples : 0, meanRgbDistance = samples ? totalDistance / samples : 0, solidFraction = samples ? solid / samples : null;
  // Mosaic preserves some source pixels by design. Treat a region as rendered only when both the changed coverage and aggregate pixel difference are material; a flat, unchanged area still fails.
  const passed = expectedMode === "block" ? solidFraction >= 0.97 : expectedMode === "emoji" ? changedFraction >= 0.15 : changedFraction >= 0.5 && meanRgbDistance >= 40;
  return { samples, changedFraction: Number(changedFraction.toFixed(4)), meanRgbDistance: Number(meanRgbDistance.toFixed(2)), solidColorFraction: solidFraction === null ? null : Number(solidFraction.toFixed(4)), passed };
}
async function imageFromBlob(blob) { const url = URL.createObjectURL(blob), image = new Image(); try { await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; }); return image; } finally { URL.revokeObjectURL(url); } }
async function checkExif(blob, mimeType) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let found = false;
  if (mimeType === "image/jpeg") { for (let i = 2; i + 9 < bytes.length; ) { if (bytes[i] !== 0xff) { i += 1; continue; } const marker = bytes[i + 1]; if (marker === 0xda || marker === 0xd9) break; const length = (bytes[i + 2] << 8) | bytes[i + 3]; if (marker === 0xe1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66 && bytes[i + 8] === 0) found = true; i += Math.max(2, length + 2); } }
  else if (mimeType === "image/png") { for (let i = 8; i + 12 <= bytes.length; ) { const length = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3], type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]); if (type === "eXIf") found = true; if (type === "IEND") break; i += 12 + length; } }
  return { checked: true, exifFound: found, passed: !found, method: mimeType === "image/jpeg" ? "JPEG APP1 Exif marker scan" : "PNG eXIf chunk scan" };
}
async function verifyExport(blob, type, style, outputHash) {
  const reloaded = await imageFromBlob(blob), verificationCanvas = document.createElement("canvas"); verificationCanvas.width = reloaded.naturalWidth; verificationCanvas.height = reloaded.naturalHeight; const output = verificationCanvas.getContext("2d", { willReadFrequently: true }); output.drawImage(reloaded, 0, 0);
  const redacted = state.regions.filter((region) => region.action === "mask"), regions = redacted.map((region) => ({ id: region.id, source: region.type, box: regionBox(region, style), verification: sampledRegionMetrics(sourceCtx, output, regionBox(region, style), style.mode, style.blockColor) })), exif = await checkExif(blob, type), dimensionsMatch = reloaded.naturalWidth === canvas.width && reloaded.naturalHeight === canvas.height, overall = dimensionsMatch && exif.passed && regions.length > 0 && regions.every((entry) => entry.verification.passed);
  verificationCanvas.width = 1; verificationCanvas.height = 1; return { overall: overall ? "passed" : "needs_review", dimensionsMatch, exif, regions, outputSha256: outputHash };
}
function makeEvidenceReport(type, outputHash, verification, style) { const masked = state.regions.filter((region) => region.action === "mask"), kept = state.regions.filter((region) => region.action === "keep"); return { schemaVersion: 1, reportType: "local-photo-privacy-evidence", generatedAt: new Date().toISOString(), software: { name: "影像隱私護罩 L1 個人版", version: APP_VERSION, processing: "browser-local memory only" }, model: { name: MODEL_VERSION, execution: "local browser CPU" }, input: { sha256: state.originalHash, sha256Status: state.originalHash ? "computed" : "unavailable", mimeType: state.sourceMime, byteLength: state.sourceByteLength, originalDimensions: state.inputDimensions, processingDimensions: { width: canvas.width, height: canvas.height } }, output: { sha256: outputHash, mimeType: type, dimensions: { width: canvas.width, height: canvas.height } }, processing: { importedPhotosThisSession: state.importCount, automaticallyDetectedFaces: state.regions.filter((region) => region.type === "face").length, redactedRegions: masked.length, keptRegions: kept.length, manualRedactedRegions: masked.filter((region) => region.type === "manual").length, style }, verification: { status: verification.overall, performedBy: "exported image reloaded in this browser", dimensionsMatch: verification.dimensionsMatch, exif: verification.exif, regions: verification.regions, humanReviewRequired: true, limitation: "像素驗證只確認輸出區域已依目前規則改寫，不能保證偵測到所有人臉，也不能判定所有情境下的去識別效果。" }, privacy: { containsImageData: false, containsEmbeddedImage: false, storesNoPhotoInPersistentCache: true, sessionClearing: "photo pixels, regions, hashes and report are released when replacing a photo or using 清除工作階段；browser/runtime memory cannot be guaranteed securely erased." } }; }
function downloadBlob(blob, name) { const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function downloadPhoto() {
  if (!state.image) return; if (!state.regions.some((region) => region.action === "mask")) { els.status.textContent = "請至少選擇一個遮蔽範圍後再匯出"; return; }
  els.status.textContent = "產生匯出並重新載入驗證…"; invalidateReport(); const style = currentStyle(), type = els.format.value, quality = Number(els.quality.value) / 100, output = exportCanvas(style), blob = await blobFromCanvas(output, type, quality); output.width = 1; output.height = 1; if (!blob) { els.status.textContent = "無法建立匯出檔"; return; }
  try { const outputHash = await sha256(blob), verification = await verifyExport(blob, type, style, outputHash); state.report = makeEvidenceReport(type, outputHash, verification, style); els.report.disabled = false; els.verification.hidden = false; els.verification.textContent = verification.overall === "passed" ? "匯出已重新載入並通過像素／EXIF 檢查；仍請人工檢視。" : "匯出已建立，但自動驗證需要人工複核；請查看證據報告。"; els.verification.className = verification.overall === "passed" ? "verification passed" : "verification needs-review"; els.status.textContent = verification.overall === "passed" ? "匯出驗證完成" : "匯出完成，驗證需要複核"; }
  catch (error) { console.error(error); els.status.textContent = "匯出完成，但此瀏覽器無法完成 SHA-256／重新載入驗證"; els.verification.hidden = false; els.verification.className = "verification needs-review"; els.verification.textContent = "驗證未完成；請使用支援 Web Crypto 的現代瀏覽器。"; }
  downloadBlob(blob, `${state.imageName.replace(/\.[^.]+$/, "")}-隱私保護.${type === "image/png" ? "png" : "jpg"}`);
}
function downloadReport() { if (!state.report) return; downloadBlob(new Blob([JSON.stringify(state.report, null, 2)], { type: "application/json" }), `${state.imageName.replace(/\.[^.]+$/, "")}-隱私保護-證據報告.json`); }
function imagePoint(event) { const rect = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)), y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height)) }; }
function setManualMode(enabled) { state.manualMode = enabled; els.manual.classList.toggle("active", enabled); els.manual.setAttribute("aria-pressed", String(enabled)); canvas.classList.toggle("manual-mode", enabled); }
canvas.addEventListener("pointerdown", (event) => { if (!state.manualMode || !state.image) return; event.preventDefault(); const point = imagePoint(event); state.manualDraft = { x: point.x, y: point.y, width: 0, height: 0 }; canvas.setPointerCapture(event.pointerId); draw(); });
canvas.addEventListener("pointermove", (event) => { if (!state.manualDraft) return; const point = imagePoint(event), startX = state.manualDraft.x, startY = state.manualDraft.y; state.manualDraft = { x: Math.min(startX, point.x), y: Math.min(startY, point.y), width: Math.abs(point.x - startX), height: Math.abs(point.y - startY) }; draw(); });
canvas.addEventListener("pointerup", (event) => { if (!state.manualDraft) return; const box = state.manualDraft; state.manualDraft = null; if (box.width >= 8 && box.height >= 8) { state.regions.push({ id: nextId("manual"), type: "manual", box, score: null, action: "mask" }); invalidateReport(); renderRegions(); } setManualMode(false); draw(); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
canvas.addEventListener("pointercancel", () => { state.manualDraft = null; draw(); });
els.file.addEventListener("change", (event) => importImage(event.target.files[0]));
for (const event of ["dragenter", "dragover"]) els.empty.addEventListener(event, (event2) => { event2.preventDefault(); els.empty.classList.add("dragging"); });
for (const event of ["dragleave", "drop"]) els.empty.addEventListener(event, (event2) => { event2.preventDefault(); els.empty.classList.remove("dragging"); });
els.empty.addEventListener("drop", (event) => importImage(event.dataTransfer.files[0]));
document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener("change", () => { invalidateReport(); draw(); })); [els.emoji, els.blockColor].forEach((el) => el.addEventListener("input", () => { invalidateReport(); draw(); })); els.padding.addEventListener("input", () => { els.paddingOut.value = `${els.padding.value}%`; invalidateReport(); draw(); }); els.quality.addEventListener("input", () => { els.qualityOut.value = els.quality.value; invalidateReport(); }); els.format.addEventListener("change", () => { els.qualityRow.hidden = els.format.value === "image/png"; invalidateReport(); });
$("maskAllButton").onclick = () => { state.regions.forEach((region) => { region.action = "mask"; }); invalidateReport(); renderRegions(); draw(); };
els.manual.onclick = () => setManualMode(!state.manualMode); $("downloadButton").onclick = downloadPhoto; els.report.onclick = downloadReport; $("newImageButton").onclick = resetToUpload; els.clear.onclick = resetToUpload;
window.addEventListener("pagehide", () => { releasePhotoMemory(); try { state.detector?.close?.(); } catch { /* best-effort browser disposal */ } });
