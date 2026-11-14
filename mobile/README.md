# VidSavor Mobile Applications (Android & iOS)

This folder contains the complete, production-ready cross-platform mobile application for **VidSavor**, built with Flutter and native platform channels.

---

## 🌟 The Core Social Media Share Sheet Workflow

When a user is watching a video or reel inside **Instagram, TikTok, YouTube, Facebook, Twitter (X), or Pinterest**:

```
[Social Media App]
       │
       ▼  User taps "Share" button
[Native System Share Sheet]
       │
       ▼  User taps "VidSavor"
[VidSavor Mobile App Launches]
       │
       ├─► Automatically receives shared link
       ├─► Strips extra text & extracts pure URL
       ├─► Queries VidSavor high-speed backend (/api/fetch)
       ├─► Displays Video Title, Poster & Available Qualities
       │
       ▼  User taps "Download"
[Direct Local Save]
       ├─► Android: Saved to /Download or /Movies (Visible in Gallery)
       └─► iOS: Saved to Apple Photos Camera Roll
```

---

## 📱 Android Setup & APK Build

### 1. Prerequisites
- [Flutter SDK](https://flutter.dev) (v3.0+)
- [Android Studio](https://developer.android.com/studio) with Android SDK 34

### 2. Build Release APK
Navigate to the app directory:
```bash
cd mobile/vidsavor_app
flutter pub get
flutter build apk --release
```
The compiled APK will be located at:
```
mobile/vidsavor_app/build/app/outputs/flutter-apk/app-release.apk
```

### 3. Install on Android Phone
Connect your phone via USB with USB Debugging enabled:
```bash
adb install -r build/app/outputs/flutter-apk/app-release.apk
```
Or simply copy the `.apk` file to your phone and tap to install!

### 4. How the Android Share Sheet Works
Registered in `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```
When you share from Instagram or TikTok, Android automatically matches this intent filter and puts **VidSavor** right at the top of your share options!

---

## 🍏 iOS Setup (Xcode & Share Extension)

### 1. Prerequisites
- macOS with Xcode 15+
- CocoaPods (`sudo gem install cocoapods`)

### 2. Build & Install
```bash
cd mobile/vidsavor_app
flutter pub get
cd ios
pod install
open Runner.xcworkspace
```

In Xcode:
1. Under **Runner Target** -> **Signing & Capabilities**, select your Apple Developer Team.
2. Under **ShareExtension Target** -> **Signing & Capabilities**, select the same Team.
3. Select your connected iPhone and click **Run (Cmd + R)**.

---

## 🌐 Instant Zero-Install Option: Progressive Web App (PWA)

For Android & iOS users who prefer not to download an APK:
1. Open `https://vidsavor.vercel.app` in Chrome on Android.
2. Tap the browser menu `(⋮)` ➔ **"Install app"** (or **"Add to Home Screen"**).
3. Android creates a native WebAPK with our registered `share_target` in `manifest.json`.
4. Now, whenever you tap **Share** on any reel, **VidSavor** appears directly in the Android share sheet and auto-fetches the video!
