export const config = {
  runtime: 'edge',
};

function unpackTokenUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  if (rawUrl.includes('token=')) {
    try {
      const match = rawUrl.match(/[?&]token=([^&#\s]+)/);
      if (match) {
        const parts = match[1].split('.');
        if (parts.length >= 2) {
          let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (payload.length % 4) {
            payload += '=';
          }
          const decoded = atob(payload);
          const data = JSON.parse(decoded);
          if (data && data.url && typeof data.url === 'string') {
            const cand = data.url.replace(/&amp;/g, '&').trim();
            if (cand.startsWith('http')) {
              return unpackTokenUrl(cand);
            }
          }
        }
      }
    } catch (e) {}
  }
  return rawUrl;
}

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

    const resolvedTargetUrl = unpackTokenUrl(targetUrl);

    let cleanFilename = decodeURIComponent(rawFilename).replace(/["\r\n]/g, '').trim();
    if (!cleanFilename) {
      cleanFilename = 'vidsavor_video.mp4';
    }

    const domain = resolvedTargetUrl.toLowerCase();

    const headers = new Headers();
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    headers.set('Accept', '*/*');
    headers.set('Accept-Encoding', 'identity');

    // Forward range header ONLY if client requested range (enables download resume)
    const clientRange = request.headers.get('range');
    if (clientRange) {
      headers.set('Range', clientRange);
    }

    let finalFetchUrl = resolvedTargetUrl;
    if (finalFetchUrl.includes('/proxy-download?url=')) {
      try {
        const uMatch = finalFetchUrl.match(/[?&]url=([^&]+)/);
        if (uMatch) {
          finalFetchUrl = decodeURIComponent(uMatch[1]);
        }
      } catch (e) {}
    }

    if (finalFetchUrl.startsWith('/download-file')) {
      finalFetchUrl = 'https://freevideosave.com' + finalFetchUrl;
    }

    // Determine platform referer
    if (domain.includes('vidssave.com') || finalFetchUrl.includes('vidssave.com')) {
      headers.set('Referer', 'https://vidssave.com/');
    } else if (domain.includes('savenow.to') || domain.includes('lbserver.xyz') || finalFetchUrl.includes('savenow.to') || finalFetchUrl.includes('lbserver.xyz')) {
      headers.set('Referer', 'https://loader.to/');
      headers.set('Origin', 'https://loader.to');
    } else if (domain.includes('googlevideo') || finalFetchUrl.includes('googlevideo')) {
      // Do not send platform referer for googlevideo CDN streams (avoids 403 hotlink blocks)
      headers.delete('Referer');
    } else if (clientReferer && clientReferer.startsWith('http') && !domain.includes('cdninstagram') && !domain.includes('fbcdn')) {
      headers.set('Referer', clientReferer);
    } else if (domain.includes('tiktok') || domain.includes('byteoversea') || domain.includes('ibytedtos')) {
      headers.set('Referer', 'https://www.tiktok.com/');
    } else if (domain.includes('twimg') || domain.includes('twitter') || domain.includes('x.com')) {
      headers.set('Referer', 'https://x.com/');
    } else if (domain.includes('pinimg.com') || finalFetchUrl.includes('pinimg.com')) {
      headers.set('Referer', 'https://www.pinterest.com/');
    }

    // Fetch stream from origin CDN
    let cdnRes = await fetch(finalFetchUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: headers,
      redirect: 'follow',
    });

    // If 403 Forbidden with platform Referer, retry without Referer (bypasses CDN anti-hotlinking)
    if (cdnRes.status === 403 && headers.has('Referer')) {
      headers.delete('Referer');
      cdnRes = await fetch(finalFetchUrl, {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: headers,
        redirect: 'follow',
      });
    }

    // High-Reliability Fallback 1: Use user's dedicated grapweb.com/tiktok/download.php engine for TikTok
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
      } catch (grapErr) {}
    }

    // High-Reliability Fallback 2: Use user's dedicated grapweb.com/facebook/download.php engine for Instagram & Facebook
    if (!cdnRes.ok && (domain.includes('instagram') || domain.includes('cdninstagram') || domain.includes('facebook') || domain.includes('fbcdn'))) {
      try {
        const ext = cleanFilename.split('.').pop() || 'mp4';
        const fbGrapwebUrl = `https://grapweb.com/facebook/download.php?url=${encodeURIComponent(targetUrl)}&title=${encodeURIComponent(cleanFilename)}&ext=${encodeURIComponent(ext)}`;
        const fbGrapRes = await fetch(fbGrapwebUrl, {
          method: request.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
          redirect: 'follow',
        });
        if (fbGrapRes.ok || fbGrapRes.status === 206) {
          cdnRes = fbGrapRes;
        }
      } catch (fbGrapErr) {}
    }

    // High-Reliability Fallback 3: Use user's dedicated grapweb.com/pinterest/download.php engine for Pinterest
    if (!cdnRes.ok && (domain.includes('pinimg.com') || domain.includes('pinterest'))) {
      try {
        const ext = cleanFilename.split('.').pop() || 'jpg';
        const pinGrapwebUrl = `https://grapweb.com/pinterest/download.php?url=${encodeURIComponent(targetUrl)}&title=${encodeURIComponent(cleanFilename)}&ext=${encodeURIComponent(ext)}`;
        const pinGrapRes = await fetch(pinGrapwebUrl, {
          method: request.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
          redirect: 'follow',
        });
        if (pinGrapRes.ok || pinGrapRes.status === 206) {
          cdnRes = pinGrapRes;
        }
      } catch (pinGrapErr) {}
    }

    // If failed to stream from origin or fallbacks, return clean error response with CORS
    // (Never 302 redirect to raw googlevideo / media streams, which forces the browser to open a black-screen player or fail with CORS)
    if (!cdnRes.ok && cdnRes.status !== 206) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Origin media server temporarily restricted direct streaming for this stream. Please choose another resolution (such as 720p HD or 360p) or MP3 Audio.'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
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
    const isInline = url.searchParams.get('inline') === '1' || url.searchParams.get('inline') === 'true';
    if (!isInline) {
      // RFC 5987 encoded attachment header ensures correct filename in Chrome, Edge, Safari, Firefox
      responseHeaders.set(
        'Content-Disposition',
        `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`
      );
    } else {
      responseHeaders.set('Content-Disposition', 'inline');
    }
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    const contentLength = cdnRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    // Only return 206 Partial Content if the client explicitly requested a Range
    const isRangeRequest = !!clientRange;
    const status = (isRangeRequest && cdnRes.status === 206) ? 206 : 200;

    if (isRangeRequest) {
      const contentRange = cdnRes.headers.get('content-range');
      if (contentRange) {
        responseHeaders.set('Content-Range', contentRange);
      }
    }

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
