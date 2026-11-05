import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint for Render automatic health checks
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    platform: 'Render-optimized',
    rssMB: Math.round(mem.rss / (1024 * 1024)),
    heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
    uptimeSec: Math.round(process.uptime()),
  });
});

// Serve compiled static files with optimal caching
app.use(
  express.static(path.join(__dirname, 'dist'), {
    maxAge: '1d',
    etag: true,
  })
);

// SPA fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Smart PPE System Production Server listening on http://0.0.0.0:${PORT}`);
  console.log(`📦 Optimized for Render 500MB Disk & 512MB RAM limits`);
});
