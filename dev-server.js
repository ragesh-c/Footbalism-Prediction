const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Simple parser for .env files to support local credentials
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index > 0) {
          const key = trimmed.substring(0, index).trim();
          let val = trimmed.substring(index + 1).trim();
          // Remove enclosing quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          process.env[key] = val;
        }
      });
      console.log('[Dev Server] Environment variables loaded from .env');
    } catch (err) {
      console.warn('[Dev Server] Failed to read .env file:', err.message);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // 1. Handle API Routes
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.substring(5); // Remove '/api/'
    const apiFilePath = path.join(__dirname, 'api', `${apiName}.js`);

    if (fs.existsSync(apiFilePath)) {
      try {
        // Clear require cache for hot-reloading
        delete require.cache[require.resolve(apiFilePath)];
        const apiMethod = require(apiFilePath);

        // Decorate request and response with helper methods similar to Vercel
        req.query = parsedUrl.query;
        
        let body = '';
        req.on('data', chunk => { body += chunk; });
        await new Promise((resolve) => req.on('end', resolve));
        req.body = {};
        if (body) {
          try {
            req.body = JSON.parse(body);
          } catch (e) {
            req.body = Object.fromEntries(new URLSearchParams(body));
          }
        }

        res.status = (statusCode) => {
          res.statusCode = statusCode;
          return res;
        };
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return res;
        };
        res.send = (body) => {
          res.end(body);
          return res;
        };

        await apiMethod(req, res);
      } catch (err) {
        console.error(`[Dev Server] Error in API /api/${apiName}:`, err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `API endpoint /api/${apiName} not found` }));
    }
    return;
  }

  // 2. Handle Static Files
  if (pathname === '/') {
    pathname = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, pathname);

  // Prevent path traversal attacks
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Fallback to 404.html if the file doesn't exist
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const errorPage = path.join(PUBLIC_DIR, '404.html');
    if (fs.existsSync(errorPage)) {
      filePath = errorPage;
      res.statusCode = 404;
    } else {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 500;
      res.end(`Server Error: ${err.code}`);
    } else {
      res.writeHead(res.statusCode || 200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

loadEnv();

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Footbalism Local Server running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
