import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'models/media_item.dart';
import 'services/api_service.dart';
import 'services/download_service.dart';
import 'services/share_intent_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const VidSavorApp());
}

class VidSavorApp extends StatelessWidget {
  const VidSavorApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VidSavor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7C3AED),
          primary: const Color(0xFF7C3AED),
          secondary: const Color(0xFFEC4899),
        ),
        fontFamily: 'Roboto',
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _urlController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  ExtractedMedia? _mediaData;

  @override
  void initState() {
    super.initState();

    // Initialize the Native Android & iOS Share Sheet listener
    ShareIntentService.init(onUrlReceived: (sharedText) {
      final clean = ApiService.extractCleanUrl(sharedText);
      if (clean.isNotEmpty && clean.startsWith('http')) {
        setState(() {
          _urlController.text = clean;
        });
        _fetchMedia(clean);
      }
    });
  }

  @override
  void dispose() {
    ShareIntentService.dispose();
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _fetchMedia(String url) async {
    if (url.trim().isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _mediaData = null;
    });

    try {
      final media = await ApiService.fetchMedia(url);
      setState(() {
        _mediaData = media;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _pasteClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null && data!.text!.isNotEmpty) {
      final clean = ApiService.extractCleanUrl(data.text!);
      _urlController.text = clean;
      if (clean.startsWith('http')) {
        _fetchMedia(clean);
      }
    }
  }

  void _startDownload(MediaStreamOption option) {
    final originalUrl = _urlController.text.trim();
    final safeTitle = (_mediaData?.title ?? 'vidsavor_video')
        .replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final filename = '${safeTitle}_${option.quality.replaceAll(' ', '_')}.${option.format}';
    final downloadUrl = DownloadService.resolveUrl(
      option.url,
      safeTitle,
      option.format,
      originalUrl,
    );

    double progressVal = 0.0;
    String recText = '0 MB';
    String totText = 'Calculating...';
    bool isCompleted = false;
    String? localFilePath;
    String? dlError;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  Icon(
                    isCompleted ? Icons.check_circle : Icons.downloading,
                    color: isCompleted ? Colors.green : const Color(0xFF7C3AED),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    isCompleted ? 'Download Complete!' : 'Downloading Media',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    filename,
                    style: const TextStyle(fontSize: 13, color: Colors.black87),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 16),
                  if (dlError != null)
                    Text(
                      'Error: $dlError',
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    )
                  else ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: progressVal > 0 ? progressVal : null,
                        minHeight: 8,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF7C3AED)),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '$recText / $totText',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                        Text(
                          '${(progressVal * 100).toStringAsFixed(0)}%',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
              actions: [
                if (!isCompleted && dlError == null)
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Hide'),
                  )
                else if (isCompleted && localFilePath != null) ...[
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Close'),
                  ),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7C3AED),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      DownloadService.openFile(localFilePath!);
                    },
                    icon: const Icon(Icons.play_arrow, size: 18),
                    label: const Text('Open Video'),
                  ),
                ] else
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Close'),
                  ),
              ],
            );
          },
        );
      },
    );

    DownloadService.downloadFile(
      downloadUrl: downloadUrl,
      filename: filename,
      onProgress: (p, rec, tot) {
        progressVal = p;
        recText = rec;
        totText = tot;
        if (mounted) setState(() {});
      },
    ).then((path) {
      isCompleted = true;
      localFilePath = path;
      progressVal = 1.0;
      if (mounted) setState(() {});
    }).catchError((err) {
      dlError = err.toString();
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 10),
            const Text(
              'VidSavor',
              style: TextStyle(
                color: Color(0xFF1E293B),
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.green.shade200),
              ),
              child: Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Colors.green,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  const Text(
                    'Share Ready',
                    style: TextStyle(
                      color: Colors.green,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // How to share instruction pill
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.purple.shade50, Colors.pink.shade50],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.purple.shade100),
              ),
              child: Row(
                children: [
                  const Icon(Icons.share, color: Color(0xFF7C3AED), size: 24),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Watch a Reel on Instagram/TikTok? Tap Share ➔ Select VidSavor to download instantly!',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF4C1D95),
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Input Card
            Card(
              elevation: 2,
              shadowColor: Colors.black12,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              child: Padding(
                padding: const EdgeInsets.all(14.0),
                child: Column(
                  children: [
                    TextField(
                      controller: _urlController,
                      decoration: InputDecoration(
                        hintText: 'Paste Reel, Video, or Post link...',
                        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13.5),
                        prefixIcon: const Icon(Icons.link, color: Color(0xFF7C3AED)),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.clear, color: Colors.grey),
                          onPressed: () => _urlController.clear(),
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Colors.grey.shade200),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          flex: 1,
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: _pasteClipboard,
                            icon: const Icon(Icons.paste, size: 17),
                            label: const Text('Paste'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF7C3AED),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: _isLoading ? null : () => _fetchMedia(_urlController.text),
                            icon: _isLoading
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Icon(Icons.download, size: 18),
                            label: Text(_isLoading ? 'Fetching...' : 'Download'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Text(
                  _errorMessage!,
                  style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ),
            ],

            // Results Card
            if (_mediaData != null) ...[
              const SizedBox(height: 20),
              Card(
                elevation: 3,
                shadowColor: Colors.purple.shade100,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Video info header
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_mediaData!.thumbnail.isNotEmpty)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                _mediaData!.thumbnail,
                                width: 90,
                                height: 90,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 90,
                                  height: 90,
                                  color: Colors.grey.shade200,
                                  child: const Icon(Icons.movie, color: Colors.grey),
                                ),
                              ),
                            ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _mediaData!.title,
                                  style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F172A),
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 6),
                                Wrap(
                                  spacing: 6,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: Colors.purple.shade50,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        _mediaData!.platform,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF7C3AED),
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: Colors.green.shade50,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        'No Watermark',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: Colors.green,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 18),
                      const Divider(),
                      const SizedBox(height: 10),
                      const Text(
                        'Available Formats & Qualities',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF334155),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Stream buttons
                      ..._mediaData!.options.map((opt) {
                        final isAudio = opt.type == 'audio' || opt.format == 'mp3';
                        final isPhoto = opt.type == 'photo' || opt.format == 'jpg';

                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                isAudio
                                    ? Icons.audiotrack
                                    : (isPhoto ? Icons.image : Icons.videocam),
                                color: const Color(0xFF7C3AED),
                                size: 22,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${opt.quality} (${opt.format.toUpperCase()})',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13.5,
                                      ),
                                    ),
                                    Text(
                                      opt.size,
                                      style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                                    ),
                                  ],
                                ),
                              ),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF7C3AED),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                ),
                                onPressed: () => _startDownload(opt),
                                icon: const Icon(Icons.download, size: 16),
                                label: const Text('Save', style: TextStyle(fontSize: 12.5)),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
