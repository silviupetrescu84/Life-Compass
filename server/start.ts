import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createApi } from './api.ts';

const dist = new URL('../dist/', import.meta.url);
const index = await readFile(new URL('index.html', dist)).catch(() => {
  throw new Error('Build Life Compass with npm run build before starting the server.');
});
const api = createApi();
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = req.url?.split('?')[0] ?? '';
  if (path.startsWith('/api/')) {
    await api.handle(req, res);
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }).end(index);
      return;
    }
    const asset = /^\/assets\/([\w-]+)\.(js|css)$/.exec(path);
    if (asset) {
      const file = await readFile(new URL(path.slice(1), dist)).catch(() => undefined);
      if (file) {
        const contentType = asset[2] === 'js' ? 'text/javascript' : 'text/css';
        res
          .writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' })
          .end(file);
        return;
      }
    }
  }
  res.writeHead(404).end('Page not found.');
}
const server = createServer((req, res) => {
  void handleRequest(req, res).catch((error: unknown) => {
    console.error(error);
    if (res.headersSent) res.destroy();
    else res.writeHead(500).end('Life Compass could not complete the request.');
  });
});
server.once('close', api.close);

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
server.listen(port, host, () => console.log(`Life Compass listening on ${host}:${port}`));
