import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Google Drive Streaming Proxy Route with Auto Virus Warning Bypass
  app.get("/api/proxy-drive", async (req, res) => {
    const driveId = req.query.id as string;
    if (!driveId) {
      return res.status(400).send("Missing id parameter");
    }

    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      let targetUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
      let response: Response;

      // Manual redirect follower loop (max 5 redirects) to ensure headers (like Range) are preserved
      let redirectCount = 0;
      while (true) {
        response = await fetch(targetUrl, {
          headers,
          redirect: 'manual'
        });

        if (
          response.status === 301 ||
          response.status === 302 ||
          response.status === 303 ||
          response.status === 307 ||
          response.status === 308
        ) {
          const redirectUrl = response.headers.get('location');
          if (redirectUrl && redirectCount < 5) {
            if (redirectUrl.startsWith('/')) {
              const urlObj = new URL(targetUrl);
              targetUrl = `${urlObj.origin}${redirectUrl}`;
            } else {
              targetUrl = redirectUrl;
            }
            redirectCount++;
            continue;
          }
        }
        break;
      }

      const contentType = response.headers.get('content-type') || '';
      
      // If Google Drive returns HTML, it means a virus confirmation page is shown!
      if (contentType.includes('text/html')) {
        const html = await response.text();
        
        // Match token e.g. confirm=xxxx
        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
        
        if (confirmMatch && confirmMatch[1]) {
          const confirmToken = confirmMatch[1];
          let confirmedUrl = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=${confirmToken}`;

          let confirmResponse: Response;
          let confirmRedirectCount = 0;
          while (true) {
            confirmResponse = await fetch(confirmedUrl, {
              headers,
              redirect: 'manual'
            });

            if (
              confirmResponse.status === 301 ||
              confirmResponse.status === 302 ||
              confirmResponse.status === 303 ||
              confirmResponse.status === 307 ||
              confirmResponse.status === 308
            ) {
              const redirectUrl = confirmResponse.headers.get('location');
              if (redirectUrl && confirmRedirectCount < 5) {
                if (redirectUrl.startsWith('/')) {
                  const urlObj = new URL(confirmedUrl);
                  confirmedUrl = `${urlObj.origin}${redirectUrl}`;
                } else {
                  confirmedUrl = redirectUrl;
                }
                confirmRedirectCount++;
                continue;
              }
            }
            break;
          }

          // Forward headers
          const sContentType = confirmResponse.headers.get('content-type');
          const sContentLength = confirmResponse.headers.get('content-length');
          const sContentRange = confirmResponse.headers.get('content-range');
          const sAcceptRanges = confirmResponse.headers.get('accept-ranges');

          if (sContentType) res.setHeader('content-type', sContentType);
          if (sContentLength) res.setHeader('content-length', sContentLength);
          if (sContentRange) res.setHeader('content-range', sContentRange);
          if (sAcceptRanges) res.setHeader('accept-ranges', sAcceptRanges);

          res.status(confirmResponse.status);
          if (confirmResponse.body) {
            Readable.fromWeb(confirmResponse.body as any).pipe(res);
          } else {
            res.end();
          }
          return;
        }
      }

      // Direct download worked (no virus confirmation screen)
      const fContentType = response.headers.get('content-type');
      const fContentLength = response.headers.get('content-length');
      const fContentRange = response.headers.get('content-range');
      const fAcceptRanges = response.headers.get('accept-ranges');

      if (fContentType) res.setHeader('content-type', fContentType);
      if (fContentLength) res.setHeader('content-length', fContentLength);
      if (fContentRange) res.setHeader('content-range', fContentRange);
      if (fAcceptRanges) res.setHeader('accept-ranges', fAcceptRanges);

      res.status(response.status);
      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }

    } catch (error: any) {
      console.error("Error in proxy-drive server endpoint:", error.message);
      res.status(500).send("Error proxying video/audio from Google Drive");
    }
  });

  // Vite development middleware vs production static server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
