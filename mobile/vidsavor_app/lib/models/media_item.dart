class MediaStreamOption {
  final String quality;
  final String url;
  final String format;
  final String size;
  final bool hasAudio;
  final String type; // 'video', 'audio', 'photo'

  MediaStreamOption({
    required this.quality,
    required this.url,
    required this.format,
    required this.size,
    required this.hasAudio,
    required this.type,
  });

  factory MediaStreamOption.fromJson(Map<String, dynamic> json) {
    return MediaStreamOption(
      quality: json['quality'] ?? 'HD Video',
      url: json['url'] ?? '',
      format: json['format'] ?? json['ext'] ?? 'mp4',
      size: json['size'] ?? 'HD File',
      hasAudio: json['has_audio'] ?? true,
      type: json['type'] ?? 'video',
    );
  }
}

class ExtractedMedia {
  final String title;
  final String thumbnail;
  final String duration;
  final String platform;
  final String directDownload;
  final List<MediaStreamOption> options;

  ExtractedMedia({
    required this.title,
    required this.thumbnail,
    required this.duration,
    required this.platform,
    required this.directDownload,
    required this.options,
  });

  factory ExtractedMedia.fromJson(Map<String, dynamic> json) {
    List<MediaStreamOption> streams = [];
    if (json['results'] != null && json['results'] is List) {
      for (var item in json['results']) {
        streams.add(MediaStreamOption.fromJson(item));
      }
    }

    return ExtractedMedia(
      title: json['title'] ?? 'VidSavor Media',
      thumbnail: json['thumbnail'] ?? '',
      duration: json['duration'] ?? '',
      platform: json['platform'] ?? 'Universal',
      directDownload: json['download'] ?? '',
      options: streams,
    );
  }
}
