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

    const reqUrl = new URL(request.url);
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        token = body.token || body.url || '';
        title = body.title || 'youtube_video';
        format = body.format || 'mp4';
        url = body.url || '';
        taskId = body.task_id || '';
      } catch (e) {
        // Fallback to URL searchParams
      }
    }

    token = token || reqUrl.searchParams.get('token') || reqUrl.searchParams.get('url') || '';
    title = title !== 'youtube_video' ? title : (reqUrl.searchParams.get('title') || 'youtube_video');
    format = format !== 'mp4' ? format : (reqUrl.searchParams.get('format') || 'mp4');
    url = url || reqUrl.searchParams.get('url') || '';
    taskId = taskId || reqUrl.searchParams.get('task_id') || '';

    const { cleanTitle, cleanFormat, filename } = sanitizeFilename(title, format);

    // 1. Polling mode: check status of an existing task_id
    if (taskId) {
      try {
        const chkResp = await fetch(
          `https://grapweb.com/youtube/api.php?action=check_task&task_id=${encodeURIComponent(taskId)}&title=${encodeURIComponent(cleanTitle)}&format=${cleanFormat}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const chkData = await chkResp.json();
        const candLink = chkData.direct_link || chkData.download_link;

        if (candLink && candLink.startsWith('http')) {
          try {
            const headResp = await fetch(candLink, {
              method: 'GET',
              headers: { 'User-Agent': 'Mozilla/5.0' },
              redirect: 'manual'
            });
            const loc = headResp.headers.get('location');
            if (loc && loc.startsWith('http')) {
              return new Response(JSON.stringify({ status: 'success', download_url: loc, filename }), { status: 200, headers: corsHeaders });
            }
          } catch (e) {}
          return new Response(JSON.stringify({ status: 'success', download_url: candLink, filename }), { status: 200, headers: corsHeaders });
        }

        if (chkData.status === 'running') {
          return new Response(JSON.stringify({
            status: 'pending',
            task_id: taskId,
            progress: chkData.progress,
            title: cleanTitle,
            format: cleanFormat
          }), { status: 200, headers: corsHeaders });
        }

        if (chkData.status === 'error') {
          return new Response(JSON.stringify({ status: 'error', message: chkData.message || 'Task failed' }), { status: 200, headers: corsHeaders });
        }
      } catch (e) {
        return new Response(JSON.stringify({ status: 'error', message: e.message || 'Error checking task' }), { status: 200, headers: corsHeaders });
      }
    }

    if (!token && !url) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing conversion token or URL' }), { status: 200, headers: corsHeaders });
    }

    // 2. Direct media stream fast paths
    if (token.includes('googlevideo.com') || token.includes('rapidcdn') || token.includes('snapcdn') || token.includes('/tmp/recycle/') || token.includes('down-de.vidssave.com')) {
      const proxyDl = `/api/proxy-download?url=${encodeURIComponent(token)}&filename=${encodeURIComponent(filename)}`;
      return new Response(JSON.stringify({ status: 'success', download_url: proxyDl, filename }), { status: 200, headers: corsHeaders });
    }

    if (token.includes('download_redirect')) {
      try {
        const r = await fetch(token, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
        const loc = r.headers.get('location');
        if (loc && loc.startsWith('http')) {
          return new Response(JSON.stringify({ status: 'success', download_url: loc, filename }), { status: 200, headers: corsHeaders });
        }
      } catch (e) {}
    }

    // 3. Start conversion task on Hostinger Grapweb Engine
    const startForm = new URLSearchParams();
    startForm.append('action', 'start_task');
    startForm.append('content', token);
    startForm.append('title', cleanTitle);
    startForm.append('format', cleanFormat);

    const stResp = await fetch('https://grapweb.com/youtube/api.php', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: startForm.toString()
    });

    const stData = await stResp.json();
    const immediateLink = stData.direct_link || stData.download_link;
    if (immediateLink && immediateLink.startsWith('http')) {
      try {
        const headResp = await fetch(immediateLink, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
        const loc = headResp.headers.get('location');
        if (loc && loc.startsWith('http')) {
          return new Response(JSON.stringify({ status: 'success', download_url: loc, filename }), { status: 200, headers: corsHeaders });
        }
      } catch (e) {}
      return new Response(JSON.stringify({ status: 'success', download_url: immediateLink, filename }), { status: 200, headers: corsHeaders });
    }

    const createdTaskId = stData.task_id;
    if (!createdTaskId) {
      return new Response(JSON.stringify({ status: 'error', message: stData.message || 'Could not initiate YouTube download task' }), { status: 200, headers: corsHeaders });
    }

    // 4. Poll task up to 6 iterations (~5 seconds) on the edge
    for (let i = 0; i < 6; i++) {
      await new Promise(res => setTimeout(res, 800));
      try {
        const chkResp = await fetch(
          `https://grapweb.com/youtube/api.php?action=check_task&task_id=${encodeURIComponent(createdTaskId)}&title=${encodeURIComponent(cleanTitle)}&format=${cleanFormat}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const chkData = await chkResp.json();
        const candLink = chkData.direct_link || chkData.download_link;

        if (candLink && candLink.startsWith('http')) {
          try {
            const headResp = await fetch(candLink, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
            const loc = headResp.headers.get('location');
            if (loc && loc.startsWith('http')) {
              return new Response(JSON.stringify({ status: 'success', download_url: loc, filename }), { status: 200, headers: corsHeaders });
            }
          } catch (e) {}
          return new Response(JSON.stringify({ status: 'success', download_url: candLink, filename }), { status: 200, headers: corsHeaders });
        }
      } catch (e) {}
    }

    // 5. If conversion requires more time (e.g. 1080p video muxing), return pending status with task_id
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
