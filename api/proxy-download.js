export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const rawFilename = url.searchParams.get('filename') || 'vidsavor_video.mp4';
    const clientReferer = url.searchParams.get('referer') || '';

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Valid target URL parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let cleanFilename = decodeURIComponent(rawFilename).replace(/["\r\n]/g, '').trim();
    if (!cleanFilename) {
      cleanFilename = 'vidsavor_video.mp4';
    }

    const domain = targetUrl.toLowerCase();
    const headers = new Headers();
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    headers.set('Accept', '*/*');
    headers.set('Accept-Encoding', 'identity');
    headers.set('Sec-Fetch-Dest', 'video');
    headers.set('Sec-Fetch-Mode', 'no-cors');
    headers.set('Sec-Fetch-Site', 'cross-site');

    // Forward range header if client requested range (enables Chrome download resume!)
    const clientRange = request.headers.get('range');
    if (clientRange) {
      headers.set('Range', clientRange);
    } else {
      headers.set('Range', 'bytes=0-');
    }

    // Determine platform referer
    if (clientReferer && clientReferer.startsWith('http')) {
      headers.set('Referer', clientReferer);
    } else if (domain.includes('tiktok') || domain.includes('byteoversea') || domain.includes('ibytedtos')) {
      headers.set('Referer', 'https://www.tiktok.com/');
    } else if (domain.includes('instagram') || domain.includes('cdninstagram')) {
      headers.set('Referer', 'https://www.instagram.com/');
    } else if (domain.includes('youtube') || domain.includes('googlevideo')) {
      headers.set('Referer', 'https://www.youtube.com/');
    } else if (domain.includes('facebook') || domain.includes('fbcdn')) {
      headers.set('Referer', 'https://www.facebook.com/');
    } else if (domain.includes('twimg') || domain.includes('twitter') || domain.includes('x.com')) {
      headers.set('Referer', 'https://x.com/');
    }

    // Fetch stream from origin CDN
    let cdnRes = await fetch(targetUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: headers,
      redirect: 'follow',
    });

    // If 403 Forbidden with platform Referer, retry without Referer (bypasses CDN anti-hotlinking)
    if (cdnRes.status === 403 && headers.has('Referer')) {
      headers.delete('Referer');
      cdnRes = await fetch(targetUrl, {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: headers,
        redirect: 'follow',
      });
    }

    // High-Reliability Fallback: Use user's dedicated grapweb.com/tiktok/download.php engine for TikTok
    if (!cdnRes.ok && (domain.includes('tiktok') || domain.includes('byteoversea') || domain.includes('tikwm') || domain.includes('ibytedtos'))) {
      try {
        const ext = cleanFilename.split('.').pop() || 'mp4';
        const grapwebUrl = `https://grapweb.com/tiktok/download.php?url=${encodeURIComponent(targetUrl)}&title=${encodeURIComponent(cleanFilename)}&ext=${encodeURIComponent(ext)}`;
        const grapRes = await fetch(grapwebUrl, {
          method: request.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
          redirect: 'follow',
        });
        if (grapRes.ok || grapRes.status === 206) {
          cdnRes = grapRes;
        }
      } catch (grapErr) {
        // Continue to standard error handling
      }
    }

    // If still failed
    if (!cdnRes.ok && cdnRes.status !== 206) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: cdnRes.status,
          message: `Source CDN returned HTTP ${cdnRes.status}. The stream URL may be restricted or expired.`,
        }),
        {
          status: cdnRes.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine Content-Type and ensure clean filename extension
    let contentType = cdnRes.headers.get('content-type') || 'video/mp4';
    if (!contentType || contentType.includes('text/html')) {
      if (cleanFilename.endsWith('.mp3') || cleanFilename.endsWith('.m4a')) {
        contentType = 'audio/mpeg';
      } else if (cleanFilename.endsWith('.jpg') || cleanFilename.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (cleanFilename.endsWith('.png')) {
        contentType = 'image/png';
      } else if (cleanFilename.endsWith('.webp')) {
        contentType = 'image/webp';
      } else {
        contentType = 'video/mp4';
      }
    }

    if (!cleanFilename.includes('.')) {
      cleanFilename += contentType.includes('audio') ? '.mp3' : (contentType.includes('image') ? '.jpg' : '.mp4');
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType);
    // RFC 5987 encoded attachment header ensures correct filename in Chrome, Edge, Safari, Firefox
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`
    );
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    const contentLength = cdnRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = cdnRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    const status = cdnRes.status === 206 ? 206 : 200;

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: status,
        headers: responseHeaders,
      });
    }

    // Stream binary body directly through Edge runtime without buffering or size limits
    return new Response(cdnRes.body, {
      status: status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: `Edge proxy failed: ${err.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
