import { promises as fs } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { seedAll } from './store/repos.js';
import { registerApi } from './api/routes.js';

async function main(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(config.outDir, { recursive: true });
  await seedAll();

  const app = Fastify({ logger: true, bodyLimit: 16 * 1024 * 1024 });
  await registerApi(app);

  // Serve the built designer SPA if present (production). In dev, use Vite (port 5173)
  // with a /api proxy to this server — see packages/designer/vite.config.ts.
  let hasDesigner = false;
  try {
    await fs.access(path.join(config.designerDist, 'index.html'));
    hasDesigner = true;
  } catch {
    hasDesigner = false;
  }

  if (hasDesigner) {
    await app.register(fastifyStatic, { root: config.designerDist, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.code(404).send({ error: 'not found' });
      return reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      ok: true,
      hint: '设计器尚未构建。开发模式：npm run dev:designer（Vite, http://localhost:5173）。生产：npm run build 后由本服务托管。',
      api: '/api/health',
    }));
  }

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`数据目录 ${config.dataDir}`);
  app.log.info(`输出目录 ${config.outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
