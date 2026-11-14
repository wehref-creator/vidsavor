import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/media_item.dart';

class ApiService {
  static const String baseUrl = 'https://vidsavor.vercel.app';

  /// Extracts pure HTTP(S) link from share sheet text
  static String extractCleanUrl(String text) {
    final regExp = RegExp(r'https?://[^\s"<>]+', caseSensitive: false);
    final match = regExp.firstMatch(text);
    return match != null ? match.group(0)! : text.trim();
  }

  /// Calls the VidSavor extraction API
  static Future<ExtractedMedia?> fetchMedia(String rawInput) async {
    final cleanUrl = extractCleanUrl(rawInput);
    if (cleanUrl.isEmpty || !cleanUrl.startsWith('http')) {
      throw Exception('Invalid URL provided');
    }

    try {
      var response = await http.post(
        Uri.parse('$baseUrl/api/fetch'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'url': cleanUrl}),
      ).timeout(const Duration(seconds: 20));

      if (response.statusCode != 200) {
        // Fallback to /fetch endpoint
        response = await http.post(
          Uri.parse('$baseUrl/fetch'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'url': cleanUrl}),
        ).timeout(const Duration(seconds: 20));
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['status'] == 'success') {
          return ExtractedMedia.fromJson(data);
        } else {
          throw Exception(data['message'] ?? 'Could not parse media');
        }
      } else {
        throw Exception('Server error: HTTP ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }
}
