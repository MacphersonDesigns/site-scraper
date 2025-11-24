import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { detectTechnologies } from '../src/tech-detector';
import {
  extractLinks,
  extractImages,
  extractHeadings,
  extractStructure,
  extractTextContent,
  extractMetadata,
} from '../src/extractor';

describe('Extractor', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('extractLinks', () => {
    it('should extract internal and external links', async () => {
      await page.setContent(`
        <html>
          <body>
            <a href="/about">About</a>
            <a href="https://example.com/page">Internal</a>
            <a href="https://external.com">External</a>
            <a href="#section">Hash</a>
          </body>
        </html>
      `);

      const links = await extractLinks(page, 'https://example.com');

      expect(links).toHaveLength(4);
      expect(links.find(l => l.text === 'About')?.isInternal).toBe(true);
      expect(links.find(l => l.text === 'Internal')?.isInternal).toBe(true);
      expect(links.find(l => l.text === 'External')?.isInternal).toBe(false);
      expect(links.find(l => l.text === 'Hash')?.isInternal).toBe(true);
    });
  });

  describe('extractImages', () => {
    it('should extract image information', async () => {
      await page.setContent(`
        <html>
          <body>
            <img src="https://example.com/image1.jpg" alt="Image 1" width="100" height="200">
            <img data-src="https://example.com/lazy.jpg" alt="Lazy Image">
          </body>
        </html>
      `);

      const images = await extractImages(page);

      expect(images).toHaveLength(2);
      expect(images[0].src).toContain('image1.jpg');
      expect(images[0].alt).toBe('Image 1');
    });
  });

  describe('extractHeadings', () => {
    it('should extract all heading levels', async () => {
      await page.setContent(`
        <html>
          <body>
            <h1>Main Title</h1>
            <h2>Section</h2>
            <h3>Subsection</h3>
          </body>
        </html>
      `);

      const headings = await extractHeadings(page);

      expect(headings).toHaveLength(3);
      expect(headings.find(h => h.level === 1)?.text).toBe('Main Title');
      expect(headings.find(h => h.level === 2)?.text).toBe('Section');
      expect(headings.find(h => h.level === 3)?.text).toBe('Subsection');
    });
  });

  describe('extractStructure', () => {
    it('should extract structural elements', async () => {
      await page.setContent(`
        <html>
          <body>
            <header id="main-header">Header</header>
            <nav class="main-nav">Navigation</nav>
            <main>Content</main>
            <footer>Footer</footer>
          </body>
        </html>
      `);

      const structure = await extractStructure(page);

      expect(structure.length).toBeGreaterThanOrEqual(4);
      expect(structure.find(s => s.tag === 'header')?.id).toBe('main-header');
      expect(structure.find(s => s.tag === 'nav')?.classes).toContain('main-nav');
    });
  });

  describe('extractTextContent', () => {
    it('should extract text content excluding scripts and styles', async () => {
      await page.setContent(`
        <html>
          <body>
            <p>Hello World</p>
            <script>console.log('not visible')</script>
            <style>.hidden { display: none; }</style>
            <span>More text</span>
          </body>
        </html>
      `);

      const text = await extractTextContent(page);

      expect(text).toContain('Hello World');
      expect(text).toContain('More text');
      expect(text).not.toContain('not visible');
      expect(text).not.toContain('display: none');
    });
  });

  describe('extractMetadata', () => {
    it('should extract page title and meta description', async () => {
      await page.setContent(`
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="This is a test page">
          </head>
          <body></body>
        </html>
      `);

      const metadata = await extractMetadata(page);

      expect(metadata.title).toBe('Test Page');
      expect(metadata.metaDescription).toBe('This is a test page');
    });
  });
});

describe('TechDetector', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should detect jQuery from global variable', async () => {
    await page.setContent(`
      <html>
        <body></body>
      </html>
    `);

    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).jQuery = function() {};
    });

    const tech = await detectTechnologies(page);
    const jquery = tech.find(t => t.name === 'jQuery');

    expect(jquery).toBeDefined();
    expect(jquery?.category).toBe('library');
  });

  it('should detect Next.js from global variable', async () => {
    await page.setContent(`
      <html>
        <body></body>
      </html>
    `);

    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__NEXT_DATA__ = {};
    });

    const tech = await detectTechnologies(page);
    const nextjs = tech.find(t => t.name === 'Next.js');

    expect(nextjs).toBeDefined();
    expect(nextjs?.category).toBe('framework');
  });

  it('should detect React from data attribute', async () => {
    await page.setContent(`
      <html>
        <body>
          <div data-reactroot>React App</div>
        </body>
      </html>
    `);

    const tech = await detectTechnologies(page);
    const react = tech.find(t => t.name === 'React');

    expect(react).toBeDefined();
    expect(react?.category).toBe('framework');
  });
});
