import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import {
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject,
  runProject,
  setProgressCallback,
  loadProjects,
} from './project-manager';
import type { ProjectConfig } from './types';

const DEFAULT_PORT = 3000;

// Store active WebSocket connections
const wsConnections: Set<http.ServerResponse> = new Set();

/**
 * Broadcast progress to all connected SSE clients
 */
function broadcastProgress(projectId: string, progress: number, status: string): void {
  const message = JSON.stringify({ projectId, progress, status });
  for (const res of wsConnections) {
    try {
      res.write(`data: ${message}\n\n`);
    } catch {
      wsConnections.delete(res);
    }
  }
}

/**
 * Parse JSON request body
 */
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: http.ServerResponse, data: unknown, statusCode = 200): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res: http.ServerResponse, message: string, statusCode = 400): void {
  sendJson(res, { error: message }, statusCode);
}

/**
 * Serve static files for the web UI
 */
function serveStatic(res: http.ServerResponse, filepath: string): void {
  const extMap: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const ext = path.extname(filepath);
  const contentType = extMap[ext] || 'application/octet-stream';

  // Resolve the file path relative to the dist/ui directory
  const uiDir = path.join(__dirname, 'ui');
  const fullPath = path.join(uiDir, filepath);

  // Security check: ensure path doesn't escape ui directory
  if (!fullPath.startsWith(uiDir)) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } else {
    // For SPA routing, serve index.html for non-API routes
    const indexPath = path.join(uiDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } else {
      sendError(res, 'Not Found', 404);
    }
  }
}

/**
 * Handle API requests
 */
async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<void> {
  const method = req.method || 'GET';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // SSE endpoint for real-time updates
  if (pathname === '/api/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: {"type":"connected"}\n\n');
    wsConnections.add(res);
    req.on('close', () => {
      wsConnections.delete(res);
    });
    return;
  }

  // Projects CRUD
  if (pathname === '/api/projects') {
    if (method === 'GET') {
      const projects = getAllProjects();
      sendJson(res, projects);
      return;
    }

    if (method === 'POST') {
      try {
        const body = await parseBody(req) as Partial<ProjectConfig>;
        if (!body.name || !body.urls || body.urls.length === 0) {
          sendError(res, 'Name and at least one URL are required');
          return;
        }
        const project = createProject({
          name: body.name,
          urls: body.urls,
          maxPages: body.maxPages,
          delay: body.delay,
          fullPageScreenshots: body.fullPageScreenshots,
          viewportWidth: body.viewportWidth,
          viewportHeight: body.viewportHeight,
          schedule: body.schedule,
        });
        sendJson(res, project, 201);
      } catch (e) {
        sendError(res, 'Invalid request body');
      }
      return;
    }
  }

  // Single project operations
  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = projectMatch[1];

    if (method === 'GET') {
      const project = getProject(projectId);
      if (!project) {
        sendError(res, 'Project not found', 404);
        return;
      }
      sendJson(res, project);
      return;
    }

    if (method === 'PUT') {
      try {
        const body = await parseBody(req) as Partial<ProjectConfig>;
        const project = updateProject(projectId, body);
        if (!project) {
          sendError(res, 'Project not found', 404);
          return;
        }
        sendJson(res, project);
      } catch {
        sendError(res, 'Invalid request body');
      }
      return;
    }

    if (method === 'DELETE') {
      const deleted = deleteProject(projectId);
      if (!deleted) {
        sendError(res, 'Project not found', 404);
        return;
      }
      sendJson(res, { success: true });
      return;
    }
  }

  // Run project
  const runMatch = pathname.match(/^\/api\/projects\/([^/]+)\/run$/);
  if (runMatch && method === 'POST') {
    const projectId = runMatch[1];
    const project = getProject(projectId);
    if (!project) {
      sendError(res, 'Project not found', 404);
      return;
    }
    if (project.status === 'running') {
      sendError(res, 'Project is already running');
      return;
    }
    // Start running in background
    sendJson(res, { message: 'Project started', projectId });
    runProject(projectId).catch(console.error);
    return;
  }

  sendError(res, 'Not Found', 404);
}

/**
 * Create and start the server
 */
export function startServer(port = DEFAULT_PORT): http.Server {
  // Load projects
  loadProjects();

  // Set up progress callback for SSE
  setProgressCallback(broadcastProgress);

  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';

    try {
      if (pathname.startsWith('/api/')) {
        await handleApi(req, res, pathname);
      } else {
        // Serve static files
        const filepath = pathname === '/' ? 'index.html' : pathname.slice(1);
        serveStatic(res, filepath);
      }
    } catch (error) {
      console.error('Server error:', error);
      sendError(res, 'Internal Server Error', 500);
    }
  });

  server.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  SITE SCRAPER WEB UI                      ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${String(port).padEnd(20)}  ║
║  API endpoint: http://localhost:${String(port).padEnd(5)}/api               ║
╚═══════════════════════════════════════════════════════════╝
`);
  });

  return server;
}

// Export for programmatic use
export { broadcastProgress };
