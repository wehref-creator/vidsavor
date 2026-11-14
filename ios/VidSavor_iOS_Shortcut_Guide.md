# VidSavor for iOS - Instant Share Sheet Integration

On Apple iOS (iPhone & iPad), users can download videos, reels, and stories directly from the native iOS Share Sheet into their **Apple Photos Camera Roll** using either:
1. **The Native iOS Flutter App with Share Extension** (`mobile/vidsavor_app/ios/`)
2. **The 1-Tap Apple Shortcut ("VidSavor Quick Downloader")** — no App Store, certificates, or sideloading required!

---

## 📲 Option 1: 1-Tap Apple Shortcut (Recommended for iPhone Users)

### How It Works:
When watching a Reel or Short on Instagram, TikTok, or YouTube:
1. Tap the **Share** button (arrow or paper plane).
2. Scroll the share sheet actions and tap **"VidSavor Downloader"**.
3. The video is fetched and automatically saved directly into your **Photos / Camera Roll**!

### Shortcut Architecture & Action Recipe:

```
[Action 1: Receive Input]
Receive: "URLs" and "Text" from "Share Sheet"
If no input: Get Clipboard

[Action 2: Extract Clean URL]
Match Text: (https?://[^\s]+) in Shortcut Input

[Action 3: Call VidSavor API]
Get Contents of URL:
- URL: https://vidsavor.vercel.app/api/fetch
- Method: POST
- Headers:
    Content-Type: application/json
- Request Body (JSON):
    { "url": [Matched Text] }

[Action 4: Parse Best Quality Stream]
Get Dictionary Value: "results.1.url" (or "download") from API Response

[Action 5: Download Media Stream]
Get Contents of URL: [Stream URL]

[Action 6: Save Directly to Camera Roll]
Save [Contents of URL] to "Recents" Photo Album

[Action 7: Haptic Feedback & Notification]
Show Notification: "Downloaded to Photos with VidSavor!"
Vibrate Device
```

---

## 🛠️ Option 2: Building the Native iOS App with Xcode

If you have an Apple Developer account and macOS machine:

1. Open Terminal in `mobile/vidsavor_app`:
   ```bash
   flutter pub get
   cd ios
   pod install
   ```
2. Open `Runner.xcworkspace` in Xcode.
3. Select your Development Team under **Signing & Capabilities**.
4. Both the main app `Runner` and the `ShareExtension` target are pre-configured:
   - `Runner`: registers URL scheme `vidsavor://`
   - `ShareExtension`: registers `NSExtensionActivationRule` for URLs and plain text
5. Build and run on your physical iPhone or Simulator:
   ```bash
   flutter run -d <your-ios-device-id>
   ```
6. Open Instagram or TikTok on your iPhone, tap **Share**, and you will see **VidSavor** listed in the Share Sheet!
