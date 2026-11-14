import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:open_filex/open_filex.dart';

class DownloadService {
  static final Dio _dio = Dio();

  /// Resolve attachment stream URL matching VidSavor core engine
  static String resolveUrl(String streamUrl, String title, String format, String originalUrl) {
    final safeTitle = title.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final isTikTok = originalUrl.contains('tiktok.com') ||
                     streamUrl.contains('tiktok') ||
                     streamUrl.contains('tikwm') ||
                     streamUrl.contains('byteoversea');

    if (isTikTok) {
      return 'https://grapweb.com/tiktok/download.php?url=${Uri.encodeComponent(streamUrl)}&title=${Uri.encodeComponent(safeTitle)}&ext=$format';
    }

    final isMeta = originalUrl.contains('instagram.com') ||
                   originalUrl.contains('facebook.com') ||
                   streamUrl.contains('cdninstagram.com') ||
                   streamUrl.contains('fbcdn.net');

    if (isMeta) {
      return 'https://grapweb.com/facebook/download.php?url=${Uri.encodeComponent(streamUrl)}&title=${Uri.encodeComponent(safeTitle)}&ext=$format';
    }

    return streamUrl;
  }

  /// Check & request storage permissions
  static Future<bool> requestPermissions() async {
    if (Platform.isAndroid) {
      if (await Permission.videos.request().isGranted) return true;
      if (await Permission.storage.request().isGranted) return true;
      return true; // Android 13+ Scoped Storage doesn't require broad storage
    } else if (Platform.isIOS) {
      final status = await Permission.photos.request();
      return status.isGranted || status.isLimited;
    }
    return true;
  }

  /// Downloads file with real-time progress callback
  static Future<String?> downloadFile({
    required String downloadUrl,
    required String filename,
    required Function(double progress, String receivedStr, String totalStr) onProgress,
  }) async {
    final hasPerm = await requestPermissions();
    if (!hasPerm) {
      throw Exception('Storage permission denied');
    }

    Directory? dir;
    if (Platform.isAndroid) {
      dir = Directory('/storage/emulated/0/Download');
      if (!dir.existsSync()) {
        dir = await getExternalStorageDirectory();
      }
    } else {
      dir = await getApplicationDocumentsDirectory();
    }

    if (dir == null) {
      throw Exception('Could not determine save directory');
    }

    final sanitizedFilename = filename.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    final savePath = '${dir.path}/$sanitizedFilename';

    try {
      await _dio.download(
        downloadUrl,
        savePath,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            final prog = received / total;
            final recStr = '${(received / (1024 * 1024)).toStringAsFixed(1)} MB';
            final totStr = '${(total / (1024 * 1024)).toStringAsFixed(1)} MB';
            onProgress(prog, recStr, totStr);
          } else {
            final recStr = '${(received / (1024 * 1024)).toStringAsFixed(1)} MB';
            onProgress(0.5, recStr, 'HD');
          }
        },
      );

      return savePath;
    } catch (e) {
      throw Exception('Download failed: $e');
    }
  }

  /// Open downloaded media in device video player or gallery
  static Future<void> openFile(String filePath) async {
    await OpenFilex.open(filePath);
  }
}
