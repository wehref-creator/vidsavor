export const config = {
  runtime: 'edge',
};

function sanitizeFilename(title, format) {
  let cleanTitle = (title || 'youtube_video')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  if (!cleanTitle) cleanTitle = 'youtube_video';
  let cleanFormat = (format || 'mp4').toLowerCase().trim();
  if (!['mp4', 'mp3', 'm4a', 'webm'].includes(cleanFormat)) {
    cleanFormat = 'mp4';
  }
  return { cleanTitle, cleanFormat, filename: `${cleanTitle}.${cleanFormat}` };
}

function extractYouTubeId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const m = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return m ? m[1] : null;
}

export default async function handler(request) {
  // CORS Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    let token = '';
    let title = 'youtube_video';
    let format = 'mp4';
    let url = '';
    let taskId = '';
    let action = '';
    let body = {};

    const reqUrl = new URL(request.url);
    if (request.method === 'POST') {
      try {
        body = await request.json();
        token = body.token || body.url || '';
        title = body.title || 'youtube_video';
        format = body.format || 'mp4';
        url = body.url || '';
        taskId = body.task_id || '';
        action = body.action || '';
      } catch (e) {
        // Fallback to URL searchParams
      }
    }

    action = action || reqUrl.searchParams.get('action') || '';
    token = token || reqUrl.searchParams.get('token') || reqUrl.searchParams.get('url') || '';
    title = title !== 'youtube_video' ? title : (reqUrl.searchParams.get('title') || 'youtube_video');
    format = format !== 'mp4' ? format : (reqUrl.searchParams.get('format') || 'mp4');
    url = url || reqUrl.searchParams.get('url') || '';
    taskId = taskId || reqUrl.searchParams.get('task_id') || '';

    const { cleanTitle, cleanFormat, filename } = sanitizeFilename(title, format);

    // =========================================================================
    // 1. Polling mode: check status of an existing task_id
    // =========================================================================
    if (taskId) {
      try {
        // Check SaveNow API primary
        let chkResp = await fetch(`https://p.savenow.to/api/progress?id=${encodeURIComponent(taskId)}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Origin': 'https://loader.to',
            'Referer': 'https://loader.to/'
          }
        });
        
        // Fallback to secondary if primary fails
        if (!chkResp.ok) {
          chkResp = await fetch(`https://p.lbserver.xyz/api/progress?id=${encodeURIComponent(taskId)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Origin': 'https://loader.to',
              'Referer': 'https://loader.to/'
            }
          });
        }

        if (chkResp.ok) {
          const chkData = await chkResp.json();
          if (chkData.success === 1 && chkData.download_url) {
            return new Response(JSON.stringify({
              status: 'success',
              download_url: chkData.download_url,
              filename: filename
            }), { status: 200, headers: corsHeaders });
          }

          if (chkData.progress >= 1000 && !chkData.download_url) {
            return new Response(JSON.stringify({
              status: 'error',
              message: chkData.text || 'Conversion server could not complete this format. Please select 720p HD or 360p.'
            }), { status: 200, headers: corsHeaders });
          }

          const rawProg = chkData.progress ? Math.round(chkData.progress / 10) : 50;
          return new Response(JSON.stringify({
            status: 'pending',
            task_id: taskId,
            progress: Math.min(99, Math.max(10, rawProg)),
            title: cleanTitle,
            format: cleanFormat
          }), { status: 200, headers: corsHeaders });
        }
      } catch (pollErr) {
        return new Response(JSON.stringify({
          status: 'error',
          message: pollErr.message || 'Error checking task status'
        }), { status: 200, headers: corsHeaders });
      }
    }

    // =========================================================================
    // 2. ACTION: PARSE (High-Speed YouTube Parser)
    // =========================================================================
    if (action === 'parse') {
      const targetUrl = url || token || reqUrl.searchParams.get('url') || '';
      if (!targetUrl) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'URL is required for YouTube parsing' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const vidId = extractYouTubeId(targetUrl);
      const canonicalUrl = vidId ? `https://www.youtube.com/watch?v=${vidId}` : targetUrl;

      let vidTitle = 'YouTube Video';
      let author = 'YouTube Creator';
      let thumbnail = vidId ? `https://i.ytimg.com/vi/${vidId}/maxresdefault.jpg` : '';

      try {
        const oeResp = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (oeResp.ok) {
          const oeData = await oeResp.json();
          if (oeData.title) vidTitle = oeData.title;
          if (oeData.author_name) author = oeData.author_name;
          if (oeData.thumbnail_url) thumbnail = oeData.thumbnail_url;
        }
      } catch (oeErr) {}

      const results = [
        {
          url: canonicalUrl,
          token: 'savenow:1080',
          type: 'video',
          quality: '1080p Full HD',
          has_audio: true,
          format: 'mp4',
          size: 'Full HD',
          thumbnail: thumbnail
        },
        {
          url: canonicalUrl,
          token: 'savenow:720',
          type: 'video',
          quality: '720p HD',
          has_audio: true,
          format: 'mp4',
          size: 'HD 720p',
          thumbnail: thumbnail
        },
        {
          url: canonicalUrl,
          token: 'savenow:480',
          type: 'video',
          quality: '480p SD',
          has_audio: true,
          format: 'mp4',
          size: 'Standard 480p',
          thumbnail: thumbnail
        },
        {
          url: canonicalUrl,
          token: 'savenow:360',
          type: 'video',
          quality: '360p Medium',
          has_audio: true,
          format: 'mp4',
          size: 'Medium 360p',
          thumbnail: thumbnail
        },
        {
          url: canonicalUrl,
          token: 'savenow:mp3',
          type: 'audio',
          quality: '320kbps High Quality Audio (MP3)',
          has_audio: true,
          format: 'mp3',
          size: '320kbps MP3',
          thumbnail: thumbnail
        },
        {
          url: canonicalUrl,
          token: 'savenow:m4a',
          type: 'audio',
          quality: 'Original Stereo Audio (M4A)',
          has_audio: true,
          format: 'm4a',
          size: 'Fast M4A',
          thumbnail: thumbnail
        }
      ];

      if (thumbnail) {
        results.push({
          url: thumbnail,
          type: 'photo',
          quality: 'Original Cover Poster (JPG)',
          format: 'jpg',
          size: 'Original JPG',
          thumbnail: thumbnail
        });
      }

      return new Response(JSON.stringify({
        status: 'success',
        title: vidTitle,
        thumbnail: thumbnail,
        type: 'video',
        download: results[0].url,
        author: author,
        duration: '',
        platform: 'youtube',
        results: results
      }), { status: 200, headers: corsHeaders });
    }

    // =========================================================================
    // 3. START CONVERSION TASK (SaveNow High-Speed Engine)
    // =========================================================================
    const targetVideoUrl = url || (token.startsWith('http') && (token.includes('youtube.com') || token.includes('youtu.be')) ? token : '');
    if (!targetVideoUrl) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing valid YouTube video URL' }), { status: 400, headers: corsHeaders });
    }

    let savenowFmt = '720';
    if (token && token.startsWith('savenow:')) {
      savenowFmt = token.replace('savenow:', '').trim();
    } else if (format && ['1080', '720', '480', '360', 'mp3', 'm4a', '1440', '4k'].includes(format.toLowerCase())) {
      savenowFmt = format.toLowerCase();
    } else if (cleanFormat === 'mp3') {
      savenowFmt = 'mp3';
    } else if (cleanFormat === 'm4a') {
      savenowFmt = 'm4a';
    }

    let startResp = await fetch(`https://p.savenow.to/api/v2/download?format=${savenowFmt}&url=${encodeURIComponent(targetVideoUrl)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Origin': 'https://loader.to',
        'Referer': 'https://loader.to/'
      }
    });

    if (!startResp.ok) {
      startResp = await fetch(`https://p.lbserver.xyz/api/v2/download?format=${savenowFmt}&url=${encodeURIComponent(targetVideoUrl)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin': 'https://loader.to',
          'Referer': 'https://loader.to/'
        }
      });
    }

    if (!startResp.ok) {
      return new Response(JSON.stringify({
        status: 'error',
        message: `Conversion server returned HTTP ${startResp.status}. Please try 720p or 360p.`
      }), { status: 502, headers: corsHeaders });
    }

    const startData = await startResp.json();
    if (startData.download_url) {
      return new Response(JSON.stringify({
        status: 'success',
        download_url: startData.download_url,
        filename: filename
      }), { status: 200, headers: corsHeaders });
    }

    if (!startData.id) {
      return new Response(JSON.stringify({
        status: 'error',
        message: startData.message || 'Could not start YouTube download task'
      }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      status: 'pending',
      task_id: startData.id,
      title: cleanTitle,
      format: cleanFormat
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err.message || 'Server error resolving YouTube video'
    }), { status: 500, headers: corsHeaders });
  }
}
