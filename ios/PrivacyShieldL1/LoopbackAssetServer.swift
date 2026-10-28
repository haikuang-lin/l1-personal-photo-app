import Foundation
import Network

/// Serves bundled WebApp assets only to this app's loopback address. It never
/// accepts a photo upload and does not bind to Wi-Fi or the public network.
final class LoopbackAssetServer {
  enum ServerError: LocalizedError {
    case missingResource
    case invalidRequest

    var errorDescription: String? {
      switch self {
      case .missingResource: return "找不到 App 內建資源"
      case .invalidRequest: return "無效的本機資源請求"
      }
    }
  }

  private let assetRoot = Bundle.main.resourceURL!.appendingPathComponent("WebApp").standardizedFileURL
  private let queue = DispatchQueue(label: "local.privacyshield.loopback")
  private var listener: NWListener?
  private var didResolveStart = false

  func start(completion: @escaping (Result<URL, Error>) -> Void) {
    do {
      let parameters = NWParameters.tcp
      parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
      let listener = try NWListener(using: parameters)
      self.listener = listener
      listener.newConnectionHandler = { [weak self] connection in self?.serve(connection) }
      listener.stateUpdateHandler = { [weak self, weak listener] state in
        guard let self, !self.didResolveStart else { return }
        switch state {
        case .ready:
          guard let port = listener?.port, let url = URL(string: "http://127.0.0.1:\(port)/index.html") else { return }
          self.didResolveStart = true
          completion(.success(url))
        case .failed(let error):
          self.didResolveStart = true
          completion(.failure(error))
        case .cancelled:
          self.didResolveStart = true
          completion(.failure(ServerError.missingResource))
        default:
          break
        }
      }
      listener.start(queue: queue)
    } catch {
      completion(.failure(error))
    }
  }

  func stop() {
    listener?.cancel()
    listener = nil
  }

  private func serve(_ connection: NWConnection) {
    connection.start(queue: queue)
    connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, _, _ in
      guard let self, let data else { connection.cancel(); return }
      do {
        let request = String(decoding: data, as: UTF8.self)
        let requestLine = request.split(separator: "\r\n", maxSplits: 1).first ?? ""
        let fields = requestLine.split(separator: " ")
        guard fields.count >= 2, fields[0] == "GET" else { throw ServerError.invalidRequest }
        let requestedPath = String(fields[1].split(separator: "?", maxSplits: 1).first ?? "")
        let relativePath = requestedPath == "/" ? "index.html" : requestedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !relativePath.isEmpty, !relativePath.contains("..") else { throw ServerError.invalidRequest }
        let fileURL = self.assetRoot.appendingPathComponent(relativePath).standardizedFileURL
        guard fileURL.path.hasPrefix(self.assetRoot.path + "/") else { throw ServerError.invalidRequest }
        let body = try Data(contentsOf: fileURL)
        let header = "HTTP/1.1 200 OK\r\nContent-Type: \(self.mimeType(for: fileURL))\r\nContent-Length: \(body.count)\r\nCache-Control: private, max-age=3600\r\nConnection: close\r\n\r\n"
        var response = Data(header.utf8)
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
      } catch {
        let body = Data("Not Found".utf8)
        let header = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: \(body.count)\r\nConnection: close\r\n\r\n"
        var response = Data(header.utf8)
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
      }
    }
  }

  private func mimeType(for url: URL) -> String {
    switch url.pathExtension.lowercased() {
    case "html": return "text/html; charset=utf-8"
    case "js", "mjs": return "text/javascript; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "wasm": return "application/wasm"
    case "tflite": return "application/octet-stream"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    default: return "application/octet-stream"
    }
  }
}
