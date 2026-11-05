import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Find frontend build folder
const possiblePaths = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'src', 'dist'),
  path.join(__dirname, 'build')
];

const frontendPath = possiblePaths.find(p =>
  fs.existsSync(path.join(p, 'index.html'))
);

if (frontendPath) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist','index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(500).send('Frontend build missing. Check build configuration.');
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});