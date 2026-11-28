import { defineConfig } from 'vite';
import { nativeRead } from './server/native.js';

function nativeRoutes(server) {
  server.middlewares.use(async (request, response, next) => {
    if (!request.url?.startsWith('/api/native/')) return next();
    const result = await nativeRead(new Request('http://localhost' + request.url, { method: request.method }));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  });
}

export default defineConfig({
  plugins: [{ name: 'diana-native-reads', configureServer: nativeRoutes, configurePreviewServer: nativeRoutes }],
});
