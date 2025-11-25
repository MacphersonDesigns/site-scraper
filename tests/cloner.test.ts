import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import type { ClonerConfig, CloneResult, ClonedAsset } from '../src/types';
import { SiteCloner, cloneSite } from '../src/cloner';

describe('Cloner Types', () => {
  it('should allow valid ClonerConfig', () => {
    const config: ClonerConfig = {
      url: 'https://example.com',
      outputDir: './test-output',
      downloadImages: true,
      downloadCss: true,
      downloadJs: true,
      timeout: 30000,
    };

    expect(config.url).toBe('https://example.com');
    expect(config.downloadImages).toBe(true);
  });

  it('should require only url in ClonerConfig', () => {
    const config: ClonerConfig = {
      url: 'https://example.com',
    };

    expect(config.url).toBeDefined();
    expect(config.outputDir).toBeUndefined();
    expect(config.downloadImages).toBeUndefined();
  });

  it('should validate ClonedAsset structure', () => {
    const asset: ClonedAsset = {
      originalUrl: 'https://example.com/style.css',
      localPath: './cloned-sites/example.com/assets/css/style.css',
      type: 'css',
      size: 1024,
    };

    expect(asset.originalUrl).toBe('https://example.com/style.css');
    expect(asset.type).toBe('css');
    expect(asset.size).toBe(1024);
  });

  it('should validate CloneResult structure', () => {
    const result: CloneResult = {
      url: 'https://example.com',
      outputDir: './cloned-sites/example.com',
      htmlPath: './cloned-sites/example.com/index.html',
      assets: [],
      totalAssets: 5,
      totalSize: 10240,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 2.5,
      errors: [],
    };

    expect(result.url).toBe('https://example.com');
    expect(result.totalAssets).toBe(5);
    expect(result.duration).toBe(2.5);
  });

  it('should support all ClonedAsset type values', () => {
    const types: ClonedAsset['type'][] = ['html', 'css', 'js', 'image'];

    for (const type of types) {
      const asset: ClonedAsset = {
        originalUrl: 'https://example.com/file',
        localPath: './file',
        type,
        size: 100,
      };

      expect(asset.type).toBe(type);
    }
  });
});

describe('SiteCloner', () => {
  let server: http.Server;
  let serverPort: number;
  const testOutputDir = path.join(os.tmpdir(), 'cloner-test-output');

  beforeAll(async () => {
    // Create a simple test server
    server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Test Page</title>
              <link rel="stylesheet" href="/style.css">
            </head>
            <body>
              <h1>Hello World</h1>
              <img src="/image.png" alt="Test Image">
              <script src="/script.js"></script>
            </body>
          </html>
        `);
      } else if (req.url === '/style.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end('body { margin: 0; padding: 0; }');
      } else if (req.url === '/script.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('console.log("Hello");');
      } else if (req.url === '/image.png') {
        // Return a minimal valid PNG
        const pngBuffer = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
          0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
          0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
          0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
          0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
          0x42, 0x60, 0x82
        ]);
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(pngBuffer);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          serverPort = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should clone a website and save HTML', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
    });

    expect(result.url).toBe(`http://127.0.0.1:${serverPort}`);
    expect(result.outputDir).toBe(testOutputDir);
    expect(fs.existsSync(result.htmlPath)).toBe(true);

    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('Hello World');
  });

  it('should download CSS files', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
      downloadCss: true,
    });

    const cssAssets = result.assets.filter(a => a.type === 'css');
    expect(cssAssets.length).toBeGreaterThan(0);

    const cssAsset = cssAssets[0];
    expect(fs.existsSync(cssAsset.localPath)).toBe(true);

    const cssContent = fs.readFileSync(cssAsset.localPath, 'utf-8');
    expect(cssContent).toContain('margin: 0');
  });

  it('should download JavaScript files', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
      downloadJs: true,
    });

    const jsAssets = result.assets.filter(a => a.type === 'js');
    expect(jsAssets.length).toBeGreaterThan(0);

    const jsAsset = jsAssets[0];
    expect(fs.existsSync(jsAsset.localPath)).toBe(true);

    const jsContent = fs.readFileSync(jsAsset.localPath, 'utf-8');
    expect(jsContent).toContain('console.log');
  });

  it('should download images', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
      downloadImages: true,
    });

    const imageAssets = result.assets.filter(a => a.type === 'image');
    expect(imageAssets.length).toBeGreaterThan(0);

    const imageAsset = imageAssets[0];
    expect(fs.existsSync(imageAsset.localPath)).toBe(true);
    expect(imageAsset.size).toBeGreaterThan(0);
  });

  it('should skip CSS when downloadCss is false', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
      downloadCss: false,
    });

    const cssAssets = result.assets.filter(a => a.type === 'css');
    expect(cssAssets.length).toBe(0);
  });

  it('should skip JS when downloadJs is false', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
      downloadJs: false,
    });

    const jsAssets = result.assets.filter(a => a.type === 'js');
    expect(jsAssets.length).toBe(0);
  });

  it('should skip images when downloadImages is false', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
      downloadImages: false,
    });

    const imageAssets = result.assets.filter(a => a.type === 'image');
    expect(imageAssets.length).toBe(0);
  });

  it('should create clone report', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
    });

    const reportPath = path.join(testOutputDir, 'clone-report.json');
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(report.url).toBe(`http://127.0.0.1:${serverPort}`);
    expect(report.totalAssets).toBe(result.totalAssets);
  });

  it('should create proper directory structure', async () => {
    await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
    });

    expect(fs.existsSync(path.join(testOutputDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(testOutputDir, 'assets'))).toBe(true);
    expect(fs.existsSync(path.join(testOutputDir, 'assets', 'css'))).toBe(true);
    expect(fs.existsSync(path.join(testOutputDir, 'assets', 'js'))).toBe(true);
    expect(fs.existsSync(path.join(testOutputDir, 'assets', 'images'))).toBe(true);
  });

  it('should calculate total size correctly', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
    });

    const calculatedSize = result.assets.reduce((sum, asset) => sum + asset.size, 0);
    expect(result.totalSize).toBe(calculatedSize);
    expect(result.totalSize).toBeGreaterThan(0);
  });

  it('should track duration', async () => {
    const result = await cloneSite({
      url: `http://127.0.0.1:${serverPort}`,
      outputDir: testOutputDir,
    });

    expect(result.duration).toBeGreaterThan(0);
    expect(new Date(result.startTime).getTime()).toBeLessThan(new Date(result.endTime).getTime());
  });
});
