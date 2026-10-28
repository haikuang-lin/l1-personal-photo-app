import UIKit
import WebKit
import Photos

final class PrivacyWebViewController: UIViewController, WKNavigationDelegate, WKDownloadDelegate {
  private struct PendingDownload {
    let destination: URL
    let isPhoto: Bool
  }

  private var webView: WKWebView!
  private let localServer = LoopbackAssetServer()
  private let diagnosticLabel = UILabel()
  private var pendingDownloads: [ObjectIdentifier: PendingDownload] = [:]

  override func viewDidLoad() {
    super.viewDidLoad()
    let configuration = WKWebViewConfiguration()
    configuration.preferences.isElementFullscreenEnabled = true

    webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = self
    webView.allowsBackForwardNavigationGestures = false
    webView.isOpaque = false
    webView.backgroundColor = .black
    view.addSubview(webView)
    webView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
      webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])

    diagnosticLabel.numberOfLines = 0
    diagnosticLabel.textAlignment = .center
    diagnosticLabel.textColor = .white
    diagnosticLabel.backgroundColor = UIColor(red: 0.22, green: 0.08, blue: 0.10, alpha: 0.96)
    diagnosticLabel.font = .preferredFont(forTextStyle: .body)
    diagnosticLabel.isHidden = true
    diagnosticLabel.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(diagnosticLabel)
    NSLayoutConstraint.activate([
      diagnosticLabel.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
      diagnosticLabel.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
      diagnosticLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor)
    ])

    let indexURL = Bundle.main.resourceURL!.appendingPathComponent("WebApp/index.html")
    guard FileManager.default.fileExists(atPath: indexURL.path) else {
      showDiagnostic("App 內建網頁檔遺失。請回 Xcode 重新安裝此 App。")
      print("[PrivacyShield] missing bundled index.html at \(indexURL.path)")
      return
    }
    showDiagnostic("準備離線 App…")
    localServer.start { [weak self] result in
      DispatchQueue.main.async {
        guard let self else { return }
        switch result {
        case .success(let launchURL):
          print("[PrivacyShield] loading local-only app: \(launchURL.absoluteString)")
          self.webView.load(URLRequest(url: launchURL))
        case .failure(let error):
          self.showDiagnostic("離線 App 無法啟動。\n\n\(error.localizedDescription)")
          print("[PrivacyShield] loopback server failed: \(error.localizedDescription)")
        }
      }
    }
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    diagnosticLabel.isHidden = true
    print("[PrivacyShield] initial page loaded")
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    showDiagnostic("本機網頁無法載入。\n\n\(error.localizedDescription)\n\n請將此畫面截圖傳回。")
    print("[PrivacyShield] provisional navigation failed: \(error.localizedDescription)")
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    showDiagnostic("本機網頁載入中斷。\n\n\(error.localizedDescription)\n\n請將此畫面截圖傳回。")
    print("[PrivacyShield] navigation failed: \(error.localizedDescription)")
  }

  private func showDiagnostic(_ text: String) {
    diagnosticLabel.text = text
    diagnosticLabel.isHidden = false
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
    decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
  }

  func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
    download.delegate = self
  }

  func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
    download.delegate = self
  }

  func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
    let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let destination = uniqueDownloadURL(in: directory, filename: suggestedFilename)
    let isPhoto = response.mimeType?.hasPrefix("image/") == true || ["jpg", "jpeg", "png"].contains(destination.pathExtension.lowercased())
    pendingDownloads[ObjectIdentifier(download)] = PendingDownload(destination: destination, isPhoto: isPhoto)
    completionHandler(destination)
  }

  func downloadDidFinish(_ download: WKDownload) {
    guard let pending = pendingDownloads.removeValue(forKey: ObjectIdentifier(download)) else {
      showAlert(title: "下載完成", message: "檔案已完成，但無法確認儲存位置。")
      return
    }
    if pending.isPhoto {
      savePhoto(at: pending.destination)
    } else {
      showAlert(title: "JSON 證據報告已儲存", message: "請到「檔案」App >「瀏覽」>「在我的 iPhone」>「影像隱私護罩」開啟。")
    }
  }

  func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
    pendingDownloads.removeValue(forKey: ObjectIdentifier(download))
    let alert = UIAlertController(title: "下載未完成", message: error.localizedDescription, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "好", style: .default))
    present(alert, animated: true)
  }

  private func savePhoto(at url: URL) {
    let save = {
      PHPhotoLibrary.shared().performChanges({
        PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: url)
      }) { [weak self] success, error in
        DispatchQueue.main.async {
          guard let self else { return }
          if success {
            try? FileManager.default.removeItem(at: url)
            self.showAlert(title: "處理後照片已存入相簿", message: "請到「照片」App 的「最近項目」查看。")
          } else {
            self.showAlert(title: "相簿儲存未完成", message: "照片暫留在「檔案」App >「在我的 iPhone」>「影像隱私護罩」。\n\n\(error?.localizedDescription ?? "請允許 App 新增照片後重試。")")
          }
        }
      }
    }
    let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
    if status == .authorized || status == .limited {
      save()
    } else if status == .notDetermined {
      PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
        DispatchQueue.main.async {
          if status == .authorized || status == .limited { save() }
          else { self.showAlert(title: "需要照片權限", message: "請到「設定」>「影像隱私護罩」>「照片」，允許「新增照片」，再重新匯出。照片暫留在「檔案」App。") }
        }
      }
    } else {
      showAlert(title: "需要照片權限", message: "請到「設定」>「影像隱私護罩」>「照片」，允許「新增照片」，再重新匯出。照片暫留在「檔案」App。")
    }
  }

  private func showAlert(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "好", style: .default))
    present(alert, animated: true)
  }

  private func uniqueDownloadURL(in directory: URL, filename: String) -> URL {
    let safeName = filename.isEmpty ? "privacy-shield-download" : filename
    let base = (safeName as NSString).deletingPathExtension
    let ext = (safeName as NSString).pathExtension
    var candidate = directory.appendingPathComponent(safeName)
    var suffix = 2
    while FileManager.default.fileExists(atPath: candidate.path) {
      let name = ext.isEmpty ? "\(base) (\(suffix))" : "\(base) (\(suffix)).\(ext)"
      candidate = directory.appendingPathComponent(name)
      suffix += 1
    }
    return candidate
  }

  deinit { localServer.stop() }
}

private final class BundleAssetSchemeHandler: NSObject, WKURLSchemeHandler {
  // Do not mark this URL as a directory here: URL.path then includes a trailing
  // slash on device, which made the containment check reject every asset.
  private let assetRoot: URL = Bundle.main.resourceURL!.appendingPathComponent("WebApp").standardizedFileURL

  func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
    DispatchQueue.global(qos: .userInitiated).async { [assetRoot] in
      do {
        let requestedURL = urlSchemeTask.request.url!
        let relativePath = requestedURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !relativePath.isEmpty, !relativePath.contains("..") else { throw AssetError.notFound }
        let fileURL = assetRoot.appendingPathComponent(relativePath).standardizedFileURL
        guard fileURL.path.hasPrefix(assetRoot.path + "/") else { throw AssetError.notFound }
        let data = try Data(contentsOf: fileURL)
        print("[PrivacyShield] serving bundled asset: \(relativePath)")
        let response = URLResponse(url: requestedURL, mimeType: Self.mimeType(for: fileURL), expectedContentLength: data.count, textEncodingName: Self.textEncoding(for: fileURL))
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
      } catch {
        print("[PrivacyShield] bundled asset failed: \(error.localizedDescription)")
        urlSchemeTask.didFailWithError(error)
      }
    }
  }

  func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { }

  private static func mimeType(for url: URL) -> String {
    switch url.pathExtension.lowercased() {
    case "html": return "text/html"
    case "js", "mjs": return "text/javascript"
    case "css": return "text/css"
    case "wasm": return "application/wasm"
    case "tflite": return "application/octet-stream"
    case "json": return "application/json"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    default: return "application/octet-stream"
    }
  }

  private static func textEncoding(for url: URL) -> String? {
    ["html", "js", "mjs", "css", "json"].contains(url.pathExtension.lowercased()) ? "utf-8" : nil
  }

  private enum AssetError: LocalizedError { case notFound
    var errorDescription: String? { "找不到 App 內建資源" }
  }
}
