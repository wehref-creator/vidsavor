import 'dart:async';
import 'package:flutter/services.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

class ShareIntentService {
  static const MethodChannel _nativeChannel = MethodChannel('com.vidsavor.app/share_intent');
  static StreamSubscription? _intentSub;

  /// Initialize listeners for both cold start and running app share events
  static void init({required Function(String url) onUrlReceived}) {
    // 1. Listen to running app share streams via receive_sharing_intent
    try {
      _intentSub = ReceiveSharingIntent.getTextStream().listen((String value) {
        if (value.isNotEmpty) {
          onUrlReceived(value);
        }
      }, onError: (err) {
        print("Error on receiveSharingIntent stream: $err");
      });

      // 2. Cold start share intent via receive_sharing_intent
      ReceiveSharingIntent.getInitialText().then((String? value) {
        if (value != null && value.isNotEmpty) {
          onUrlReceived(value);
        }
      });
    } catch (e) {
      print("ReceiveSharingIntent exception: $e");
    }

    // 3. Fallback / Direct Native Platform Channel
    _nativeChannel.setMethodCallHandler((call) async {
      if (call.method == 'onUrlShared' && call.arguments != null) {
        onUrlReceived(call.arguments.toString());
      }
    });

    _nativeChannel.invokeMethod('getInitialSharedText').then((val) {
      if (val != null && val.toString().isNotEmpty) {
        onUrlReceived(val.toString());
      }
    }).catchError((_) {});
  }

  static void dispose() {
    _intentSub?.cancel();
  }
}
