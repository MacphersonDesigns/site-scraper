import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type { ClonerConfig, CloneResult, ClonedAsset } from './types';

const CLONED_SITES_DIR = './cloned-sites';

/**
 * Default configuration values for the cloner
 */
const DEFAULT_CONFIG: Required<Omit<ClonerConfig, 'url' | 'outputDir'>> = {
  downloadImages: true,
  downloadCss: true,
  downloadJs: true,
  timeout: 30000,
};

/**
 * Site cloner class for cloning websites to local storage
 */
export class SiteCloner {
  private config: Required<Omit<ClonerConfig, 'outputDir'>> & { outputDir: string };
  private browser: Browser | null = null;
  private assets: ClonedAsset[] = [];
  private errors: string[] = [];

  constructor(config: ClonerConfig) {
    const hostname = this.getHostname(config.url);
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      outputDir: config.outputDir || path.join(CLONED_SITES_DIR, hostname),
    };
  }

  /**
   * Extract hostname from URL for folder naming
   */
  private getHostname(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    } catch {
      return 'unknown-site';
    }
  }

  /**
   * Initialize the browser
   */
  private async initBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    });
  }

  /**
   * Close the browser
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    // Create subdirectories for assets
    const assetsDir = path.join(this.config.outputDir, 'assets');
    const cssDir = path.join(assetsDir, 'css');
    const jsDir = path.join(assetsDir, 'js');
    const imagesDir = path.join(assetsDir, 'images');

    for (const dir of [assetsDir, cssDir, jsDir, imagesDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Generate a safe filename from a URL
   */
  private getSafeFilename(url: string, defaultName: string): string {
    try {
      const parsed = new URL(url);
      let filename = path.basename(parsed.pathname);
      if (!filename || filename === '/') {
        filename = defaultName;
      }
      // Remove query parameters from filename
      filename = filename.split('?')[0];
      // Sanitize filename
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      return filename || defaultName;
    } catch {
      return defaultName;
    }
  }

  /**
   * Download a file from URL using fetch
   */
  private async downloadFile(page: Page, url: string): Promise<Buffer | null> {
    try {
      const response = await page.evaluate(async (fileUrl) => {
        try {
          const resp = await fetch(fileUrl);
          if (!resp.ok) return null;
          const arrayBuffer = await resp.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        } catch {
          return null;
        }
      }, url);

      if (!response) return null;
      return Buffer.from(response);
    } catch (error) {
      this.errors.push(`Failed to download ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Extract and download CSS files from the page
   */
  private async extractCssFiles(page: Page): Promise<void> {
    if (!this.config.downloadCss) return;

    const cssUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links
        .map(link => link.getAttribute('href'))
        .filter((href): href is string => href !== null && href.length > 0);
    });

    for (const cssUrl of cssUrls) {
      try {
        const absoluteUrl = new URL(cssUrl, this.config.url).href;
        const filename = this.getSafeFilename(absoluteUrl, `style_${Date.now()}.css`);
        const localPath = path.join(this.config.outputDir, 'assets', 'css', filename);

        const content = await this.downloadFile(page, absoluteUrl);
        if (content) {
          fs.writeFileSync(localPath, content);
          this.assets.push({
            originalUrl: absoluteUrl,
            localPath,
            type: 'css',
            size: content.length,
          });
        }
      } catch (error) {
        this.errors.push(`Failed to process CSS ${cssUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Extract and download JavaScript files from the page
   */
  private async extractJsFiles(page: Page): Promise<void> {
    if (!this.config.downloadJs) return;

    const jsUrls = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts
        .map(script => script.getAttribute('src'))
        .filter((src): src is string => src !== null && src.length > 0);
    });

    for (const jsUrl of jsUrls) {
      try {
        const absoluteUrl = new URL(jsUrl, this.config.url).href;
        const filename = this.getSafeFilename(absoluteUrl, `script_${Date.now()}.js`);
        const localPath = path.join(this.config.outputDir, 'assets', 'js', filename);

        const content = await this.downloadFile(page, absoluteUrl);
        if (content) {
          fs.writeFileSync(localPath, content);
          this.assets.push({
            originalUrl: absoluteUrl,
            localPath,
            type: 'js',
            size: content.length,
          });
        }
      } catch (error) {
        this.errors.push(`Failed to process JS ${jsUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Extract and download images from the page
   */
  private async extractImages(page: Page): Promise<void> {
    if (!this.config.downloadImages) return;

    const imageUrls = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img[src]'));
      const srcUrls = images
        .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
        .filter((src): src is string => src !== null && src.length > 0);
      
      // Also get background images from inline styles
      const bgImages: string[] = [];
      document.querySelectorAll('[style*="background"]').forEach(el => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (match && match[1]) {
          bgImages.push(match[1]);
        }
      });

      return [...new Set([...srcUrls, ...bgImages])];
    });

    for (const imageUrl of imageUrls) {
      try {
        // Skip data URLs
        if (imageUrl.startsWith('data:')) continue;

        const absoluteUrl = new URL(imageUrl, this.config.url).href;
        const filename = this.getSafeFilename(absoluteUrl, `image_${Date.now()}.png`);
        const localPath = path.join(this.config.outputDir, 'assets', 'images', filename);

        const content = await this.downloadFile(page, absoluteUrl);
        if (content) {
          fs.writeFileSync(localPath, content);
          this.assets.push({
            originalUrl: absoluteUrl,
            localPath,
            type: 'image',
            size: content.length,
          });
        }
      } catch (error) {
        this.errors.push(`Failed to process image ${imageUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Save the HTML content with updated asset paths
   */
  private async saveHtml(page: Page): Promise<string> {
    let html = await page.content();

    // Update CSS paths to local files
    for (const asset of this.assets.filter(a => a.type === 'css')) {
      const relativePath = path.relative(this.config.outputDir, asset.localPath).replace(/\\/g, '/');
      html = html.replace(new RegExp(this.escapeRegExp(asset.originalUrl), 'g'), relativePath);
    }

    // Update JS paths to local files
    for (const asset of this.assets.filter(a => a.type === 'js')) {
      const relativePath = path.relative(this.config.outputDir, asset.localPath).replace(/\\/g, '/');
      html = html.replace(new RegExp(this.escapeRegExp(asset.originalUrl), 'g'), relativePath);
    }

    // Update image paths to local files
    for (const asset of this.assets.filter(a => a.type === 'image')) {
      const relativePath = path.relative(this.config.outputDir, asset.localPath).replace(/\\/g, '/');
      html = html.replace(new RegExp(this.escapeRegExp(asset.originalUrl), 'g'), relativePath);
    }

    const htmlPath = path.join(this.config.outputDir, 'index.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');

    // Add HTML to assets
    this.assets.push({
      originalUrl: this.config.url,
      localPath: htmlPath,
      type: 'html',
      size: Buffer.byteLength(html, 'utf-8'),
    });

    return htmlPath;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Clone the website
   */
  async clone(): Promise<CloneResult> {
    const startTime = new Date();

    console.log(`Starting clone of ${this.config.url}`);
    console.log(`Output directory: ${this.config.outputDir}`);
    console.log('---');

    this.ensureOutputDir();
    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    try {
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; SiteScraperBot/1.0; +https://github.com/MacphersonDesigns/site-scraper)',
      });

      const page = await context.newPage();

      console.log(`Loading page: ${this.config.url}`);
      await page.goto(this.config.url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // Wait for any dynamic content
      await page.waitForTimeout(500);

      console.log('Extracting CSS files...');
      await this.extractCssFiles(page);

      console.log('Extracting JavaScript files...');
      await this.extractJsFiles(page);

      console.log('Extracting images...');
      await this.extractImages(page);

      console.log('Saving HTML...');
      const htmlPath = await this.saveHtml(page);

      await context.close();

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;

      const totalSize = this.assets.reduce((sum, asset) => sum + asset.size, 0);

      const result: CloneResult = {
        url: this.config.url,
        outputDir: this.config.outputDir,
        htmlPath,
        assets: this.assets,
        totalAssets: this.assets.length,
        totalSize,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration,
        errors: this.errors,
      };

      // Save clone report
      const reportPath = path.join(this.config.outputDir, 'clone-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));

      console.log('---');
      console.log('Clone complete!');
      console.log(`Assets downloaded: ${result.totalAssets}`);
      console.log(`Total size: ${(result.totalSize / 1024).toFixed(2)} KB`);
      console.log(`Duration: ${duration.toFixed(2)} seconds`);

      if (this.errors.length > 0) {
        console.log(`Warnings/Errors: ${this.errors.length}`);
      }

      return result;
    } finally {
      await this.closeBrowser();
    }
  }
}

/**
 * Clone a website with the given configuration
 */
export async function cloneSite(config: ClonerConfig): Promise<CloneResult> {
  const cloner = new SiteCloner(config);
  return cloner.clone();
}
