import UIKit
import Social
import MobileCoreServices

class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        handleSharedContent()
    }

    private func handleSharedContent() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        // 1. Look for URL type identifier
        let urlType = kUTTypeURL as String
        let textType = kUTTypePlainText as String

        for provider in attachments {
            if provider.hasItemConformingToTypeIdentifier(urlType) {
                provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] (item, error) in
                    if let url = item as? URL {
                        self?.redirectToVidSavor(urlString: url.absoluteString)
                    } else if let urlStr = item as? String {
                        self?.redirectToVidSavor(urlString: urlStr)
                    }
                }
                return
            } else if provider.hasItemConformingToTypeIdentifier(textType) {
                provider.loadItem(forTypeIdentifier: textType, options: nil) { [weak self] (item, error) in
                    if let text = item as? String {
                        self?.redirectToVidSavor(urlString: text)
                    }
                }
                return
            }
        }

        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func redirectToVidSavor(urlString: String) {
        guard let escaped = urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let appUrl = URL(string: "vidsavor://share?url=\(escaped)") else {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        // Open VidSavor App from Share Extension
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(appUrl, options: [:], completionHandler: { [weak self] _ in
                    self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                })
                return
            }
            responder = responder?.next
        }

        // Fallback selector for UIActivityViewController context
        let selector = sel_registerName("openURL:")
        var current: UIResponder? = self
        while let next = current?.next {
            if next.responds(to: selector) {
                next.perform(selector, with: appUrl)
                break
            }
            current = next
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
}
