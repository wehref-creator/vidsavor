import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  private let CHANNEL = "com.vidsavor.app/share_intent"
  private var pendingSharedText: String?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    let shareChannel = FlutterMethodChannel(name: CHANNEL, binaryMessenger: controller.binaryMessenger)

    shareChannel.setMethodCallHandler({
      [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      if call.method == "getInitialSharedText" {
        result(self?.pendingSharedText)
        self?.pendingSharedText = nil
      } else {
        result(FlutterMethodNotImplemented)
      }
    })

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Handle incoming custom URL schemes (e.g. vidsavor://share?url=...)
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    if url.scheme == "vidsavor" {
      if let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
         let queryItems = components.queryItems {
        for item in queryItems {
          if item.name == "url" || item.name == "text", let val = item.value {
            self.pendingSharedText = val
            if let controller = window?.rootViewController as? FlutterViewController {
              let shareChannel = FlutterMethodChannel(name: CHANNEL, binaryMessenger: controller.binaryMessenger)
              shareChannel.invokeMethod("onUrlShared", arguments: val)
            }
            return true
          }
        }
      }
    }
    return super.application(app, open: url, options: options)
  }
}
