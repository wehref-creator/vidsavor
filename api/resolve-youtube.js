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

function resolveGrapwebLink(link) {
  if (!link || typeof link !== 'string') return null;
  const trimmed = link.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://grapweb.com/youtube/${trimmed.replace(/^\//, '')}`;
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

    // =========================================================================
    // ACTION: PARSE (High-Speed Edge Parser for YouTube)
    // =========================================================================
    if (action === 'parse') {
      const targetUrl = url || token || reqUrl.searchParams.get('url') || '';
      if (!targetUrl) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'URL is required for YouTube parsing' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Tier 0: Instant Direct Stream Engine (Zero Conversion Wait, 200 OK Direct Video/Audio Streams)
      try {
        const fvResp = await fetch('https://freevideosave.com/fetch', {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Origin': 'https://freevideosave.com',
            'Referer': 'https://freevideosave.com/',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: targetUrl })
        });

        if (fvResp.ok) {
          const fvData = await fvResp.json();
          if (fvData && fvData.status === 'success' && fvData.results && fvData.results.length > 0) {
            const vidTitle = fvData.title || 'YouTube Video';
            const thumbnail = fvData.thumbnail || '';
            const results = [];
            const seenQualities = new Set();

            function formatBytes(bytes) {
              if (!bytes || bytes <= 0) return 'HD Stream';
              const units = ['B', 'KB', 'MB', 'GB'];
              let i = 0;
              let s = bytes;
              while (s >= 1024 && i < units.length - 1) {
                s /= 1024;
                i++;
              }
              return `${s.toFixed(1)} ${units[i]}`;
            }

            for (const item of fvData.results) {
              if (item.type !== 'video' || !item.url) continue;
              let directMediaUrl = item.url;
              if (directMediaUrl.includes('url=')) {
                try {
                  const match = directMediaUrl.match(/[?&]url=([^&]+)/);
                  if (match) {
                    let decoded = match[1];
                    while (decoded.includes('%25') || decoded.includes('%3A') || decoded.includes('%3a')) {
                      decoded = decodeURIComponent(decoded);
                    }
                    directMediaUrl = decoded;
                  }
                } catch (e) {}
              }
              if (!directMediaUrl.startsWith('http')) {
                directMediaUrl = `https://freevideosave.com${directMediaUrl}`;
              }
              if (directMediaUrl.includes('googlevideo.com') && !directMediaUrl.includes('title=')) {
                const safeName = (vidTitle || 'vidsavor_video').slice(0, 45).replace(/[^a-zA-Z0-9_-]/g, '_');
                directMediaUrl += (directMediaUrl.includes('?') ? '&' : '?') + `title=${encodeURIComponent(safeName)}`;
              }
              const fullUrl = directMediaUrl;
              let sizeStr = 'HD Stream';
              try {
                const unquoted = decodeURIComponent(fullUrl);
                const clenMatch = unquoted.match(/[?&]clen=(\d+)/);
                if (clenMatch) {
                  sizeStr = formatBytes(parseInt(clenMatch[1], 10));
                }
              } catch (e) {}

              const qLower = (item.quality || '').toLowerCase();
              let label = item.quality || 'HD Video';
              if (qLower.includes('2160p')) label = '2160p (4K Ultra HD)';
              else if (qLower.includes('1440p')) label = '1440p (2K QHD)';
              else if (qLower.includes('1080p')) label = '1080p Full HD';
              else if (qLower.includes('720p')) label = '720p HD';
              else if (qLower.includes('480p')) label = '480p SD';
              else if (qLower.includes('360p')) label = '360p Medium';
              else if (qLower.includes('240p')) label = '240p';
              else if (qLower.includes('144p')) label = '144p';

              if (seenQualities.has(label)) continue;
              seenQualities.add(label);

              results.push({
                url: fullUrl,
                type: 'video',
                quality: label,
                has_audio: true,
                format: 'mp4',
                size: sizeStr,
                thumbnail: thumbnail
              });
            }

            // Audio streams
            for (const item of fvData.results) {
              if (item.type !== 'audio' || !item.url) continue;
              let directMediaUrl = item.url;
              if (directMediaUrl.includes('url=')) {
                try {
                  const match = directMediaUrl.match(/[?&]url=([^&]+)/);
                  if (match) {
                    let decoded = match[1];
                    while (decoded.includes('%25') || decoded.includes('%3A') || decoded.includes('%3a')) {
                      decoded = decodeURIComponent(decoded);
                    }
                    directMediaUrl = decoded;
                  }
                } catch (e) {}
              }
              if (!directMediaUrl.startsWith('http')) {
                directMediaUrl = `https://freevideosave.com${directMediaUrl}`;
              }
              if (directMediaUrl.includes('googlevideo.com') && !directMediaUrl.includes('title=')) {
                const safeName = (vidTitle || 'vidsavor_audio').slice(0, 45).replace(/[^a-zA-Z0-9_-]/g, '_');
                directMediaUrl += (directMediaUrl.includes('?') ? '&' : '?') + `title=${encodeURIComponent(safeName)}`;
              }
              const fullUrl = directMediaUrl;
              let sizeStr = 'High Audio';
              try {
                const unquoted = decodeURIComponent(fullUrl);
                const clenMatch = unquoted.match(/[?&]clen=(\d+)/);
                if (clenMatch) {
                  sizeStr = formatBytes(parseInt(clenMatch[1], 10));
                }
              } catch (e) {}

              let cleanAudioQ = item.quality || 'Audio';
              if (cleanAudioQ.includes('129kb') || cleanAudioQ.toLowerCase().includes('aac')) {
                cleanAudioQ = '320kbps High Quality';
              } else if (cleanAudioQ.toLowerCase().includes('opus') || cleanAudioQ.includes('124kb')) {
                cleanAudioQ = 'Stereo Audio';
              }

              results.push({
                url: fullUrl,
                type: 'audio',
                quality: `${cleanAudioQ} Audio (MP3)`,
                has_audio: true,
                format: 'mp3',
                size: sizeStr,
                thumbnail: thumbnail
              });
            }

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

            if (results.length > 0) {
              return new Response(
                JSON.stringify({
                  status: 'success',
                  title: vidTitle,
                  thumbnail: thumbnail,
                  type: 'video',
                  download: results[0].url,
                  author: 'YouTube Creator',
                  platform: 'youtube',
                  results: results,
                  data: {
                    title: vidTitle,
                    thumbnail: thumbnail,
                    author: 'YouTube Creator',
                    results: results
                  }
                }),
                { status: 200, headers: corsHeaders }
              );
            }
          }
        }
      } catch (tier0Err) {
        // Fall through to Tier 1 Grapweb
      }

      // Tier 1: Hostinger Grapweb Parse API
      try {
        const grapResp = await fetch(
          `https://grapweb.com/youtube/api.php?action=parse&url=${encodeURIComponent(targetUrl)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          }
        );

        if (!grapResp.ok) {
          return new Response(
            JSON.stringify({ status: 'error', message: `Hostinger parser returned HTTP ${grapResp.status}` }),
            { status: grapResp.status, headers: corsHeaders }
          );
        }

        const grapData = await grapResp.json();
        if (!grapData || grapData.status !== 'success' || !grapData.data) {
          return new Response(
            JSON.stringify({ status: 'error', message: grapData?.message || 'Could not parse YouTube video details' }),
            { status: 404, headers: corsHeaders }
          );
        }

        const info = grapData.data;
        const vidTitle = info.title || 'YouTube Video';
        const thumbnail = info.thumbnail || '';
        const author = info.author || 'YouTube Creator';
        const duration = info.durationFormatted || '';

        const results = [];
        const seenQualities = new Set();

        for (const v of (info.videos || [])) {
          const q = (v.quality || '').toUpperCase();
          if (seenQualities.has(q)) continue;
          seenQualities.add(q);

          let label = q;
          if (['1080P', '1080P60', 'FHD'].includes(q)) label = '1080p Full HD';
          else if (['720P', 'HD'].includes(q)) label = '720p HD';
          else if (q === '2160P') label = '2160p (4K Ultra HD)';
          else if (q === '1440P') label = '1440p (2K QHD)';
          else if (q === '480P') label = '480p SD';
          else if (q === '360P') label = '360p';

          const tokenVal = v.resource_content || '';
          const dlVal = v.download_url || '';
          const target = dlVal || tokenVal;
          if (!target) continue;

          results.push({
            url: target,
            token: dlVal ? '' : tokenVal,
            type: 'video',
            quality: label,
            has_audio: true,
            format: 'mp4',
            size: v.sizeFormatted || 'HD Stream',
            thumbnail: thumbnail
          });
        }

        for (const a of (info.audios || [])) {
          const q = (a.quality || '').toUpperCase();
          const tokenVal = a.resource_content || '';
          const dlVal = a.download_url || '';
          const target = dlVal || tokenVal;
          if (!target) continue;

          results.push({
            url: target,
            token: dlVal ? '' : tokenVal,
            type: 'audio',
            quality: `${q} Audio (MP3)`,
            has_audio: true,
            format: 'mp3',
            size: a.sizeFormatted || 'High Audio',
            thumbnail: thumbnail
          });
        }

        if (thumbnail) {
          results.push({
            url: thumbnail,
            type: 'photo',
            quality: 'HD Cover Poster (JPG)',
            format: 'jpg',
            size: 'Original JPG',
            thumbnail: thumbnail
          });
        }

        return new Response(
          JSON.stringify({
            status: 'success',
            title: vidTitle,
            thumbnail: thumbnail,
            type: 'video',
            download: results[0]?.url || '',
            author: author,
            duration: duration,
            platform: 'youtube',
            results: results
          }),
          { status: 200, headers: corsHeaders }
        );
      } catch (parseErr) {
        return new Response(
          JSON.stringify({ status: 'error', message: `YouTube parser error: ${parseErr.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    const { cleanTitle, cleanFormat, filename } = sanitizeFilename(title, format);

    // =========================================================================
    // 1. Polling mode: check status of an existing task_id
    // =========================================================================
    if (taskId) {
      try {
        const chkResp = await fetch(
          `https://grapweb.com/youtube/api.php?action=check_task&task_id=${encodeURIComponent(taskId)}&title=${encodeURIComponent(cleanTitle)}&format=${cleanFormat}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
        );
        const chkData = await chkResp.json();
        const rawLink = chkData.direct_link || chkData.download_link;
        const candLink = resolveGrapwebLink(rawLink);

        if (candLink && candLink.startsWith('http')) {
          // Route all completed task links through edge proxy with Content-Disposition: attachment
          const proxyDl = candLink.startsWith('/api/proxy-download') ? candLink : `/api/proxy-download?url=${encodeURIComponent(candLink)}&filename=${encodeURIComponent(filename)}`;
          return new Response(JSON.stringify({ status: 'success', download_url: proxyDl, filename }), { status: 200, headers: corsHeaders });
        }

        if (chkData.status === 'running' || chkData.status === 'pending') {
          return new Response(JSON.stringify({
            status: 'pending',
            task_id: taskId,
            progress: chkData.progress,
            title: cleanTitle,
            format: cleanFormat
          }), { status: 200, headers: corsHeaders });
        }

        if (chkData.status === 'error') {
          let errMsg = chkData.message || 'Task failed on conversion server';
          if (errMsg.includes('Could not initialize download task')) {
            errMsg = 'Ultra HD 4K streams (>2 GB) exceed online cloud conversion limits for long videos. Please select 1080p Full HD (554 MB) or 720p HD for instant download!';
          }
          return new Response(JSON.stringify({ status: 'error', message: errMsg }), { status: 200, headers: corsHeaders });
        }

        // Default to pending if still within processing
        return new Response(JSON.stringify({
          status: 'pending',
          task_id: taskId,
          progress: chkData.progress || 50,
          title: cleanTitle,
          format: cleanFormat
        }), { status: 200, headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ status: 'error', message: e.message || 'Error checking task status' }), { status: 200, headers: corsHeaders });
      }
    }

    if (!token && !url) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing conversion token or URL' }), { status: 200, headers: corsHeaders });
    }

    // =========================================================================
    // 2. Direct media stream fast paths (Stream via Edge Proxy with Content-Disposition: attachment)
    // =========================================================================
    if (token.includes('freevideosave.com') || token.includes('download_redirect') || token.includes('googlevideo.com') || token.includes('rapidcdn') || token.includes('snapcdn') || token.includes('/tmp/recycle/') || token.includes('vidssave.com')) {
      const proxyDl = token.startsWith('/api/proxy-download') ? token : `/api/proxy-download?url=${encodeURIComponent(token)}&filename=${encodeURIComponent(filename)}`;
      return new Response(JSON.stringify({ status: 'success', download_url: proxyDl, filename }), { status: 200, headers: corsHeaders });
    }

    // =========================================================================
    // 3. Start conversion task on Hostinger Grapweb Engine
    // =========================================================================
    const startForm = new URLSearchParams();
    startForm.append('action', 'start_task');
    startForm.append('content', token);
    startForm.append('title', cleanTitle);
    startForm.append('format', cleanFormat);

    const stResp = await fetch('https://grapweb.com/youtube/api.php', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: startForm.toString()
    });

    const stData = await stResp.json();
    const immediateRaw = stData.direct_link || stData.download_link;
    const immediateLink = resolveGrapwebLink(immediateRaw);

    if (immediateLink && immediateLink.startsWith('http')) {
      const proxyDl = immediateLink.startsWith('/api/proxy-download') ? immediateLink : `/api/proxy-download?url=${encodeURIComponent(immediateLink)}&filename=${encodeURIComponent(filename)}`;
      return new Response(JSON.stringify({ status: 'success', download_url: proxyDl, filename }), { status: 200, headers: corsHeaders });
    }

    const createdTaskId = stData.task_id;
    if (!createdTaskId) {
      let errMsg = stData.message || 'Could not initiate YouTube download task';
      if (errMsg.includes('Could not initialize download task')) {
        errMsg = 'Ultra HD 4K streams (>2 GB) exceed online cloud conversion limits for long videos. Please select 1080p Full HD (554 MB) or 720p HD for instant download!';
      }
      return new Response(JSON.stringify({ status: 'error', message: errMsg }), { status: 200, headers: corsHeaders });
    }

    // Return pending status immediately to client browser so the client drives
    // polling with real-time UI progress and zero Vercel serverless gateway timeouts (<1.5s total time)
    return new Response(JSON.stringify({
      status: 'pending',
      task_id: createdTaskId,
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
