import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type { ScraperConfig, PageData, SiteReport, TechnologyInfo } from './types';
import { extractPageData } from './extractor';
import {
  disablePageAnimations,
  downloadAssets,
  formatBytes,
  logCrawling,
  logScreenshot,
  logAssetDownload,
  logDownloaded,
  logDownloadFailed,
  logTechnologies,
  logPageComplete,
} from './utils';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<ScraperConfig, 'baseUrl'>> = {
  maxPages: 50,
  screenshotDir: './screenshots',
  outputDir: './output',
  delay: 1000,
  screenshotQuality: 90,
  fullPageScreenshots: true,
  viewportWidth: 1920,
  viewportHeight: 1080,
  disableAnimations: true,
  downloadAssets: false,
  downloadImages: true,
  downloadCSS: false,
  downloadJS: false,
  assetTimeout: 5000,
  maxAssetSize: 10 * 1024 * 1024,
  verbose: false,
};

/**
 * Main site crawler class
 */
export class SiteCrawler {
  private config: Required<ScraperConfig>;
  private browser: Browser | null = null;
  private visitedUrls: Set<string> = new Set();
  private urlsToVisit: string[] = [];
  private pages: PageData[] = [];
  private startTime: Date = new Date();

  constructor(config: ScraperConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
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
   * Ensure output directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.config.screenshotDir)) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Normalize URL for comparison
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash and hash
      let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
      if (normalized.endsWith('/') && normalized !== `${parsed.protocol}//${parsed.host}/`) {
        normalized = normalized.slice(0, -1);
      }
      // Include query parameters but sort them for consistency
      if (parsed.search) {
        normalized += parsed.search;
      }
      return normalized;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL should be crawled
   */
  private shouldCrawl(url: string): boolean {
    try {
      const baseHostname = new URL(this.config.baseUrl).hostname;
      const urlHostname = new URL(url).hostname;

      // Only crawl internal URLs
      if (urlHostname !== baseHostname) return false;

      // Skip non-HTML resources
      const pathname = new URL(url).pathname.toLowerCase();
      const skipExtensions = ['.pdf', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.mp4', '.webm', '.mp3'];
      if (skipExtensions.some(ext => pathname.endsWith(ext))) return false;

      // Skip already visited
      const normalized = this.normalizeUrl(url);
      if (this.visitedUrls.has(normalized)) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate screenshot filename from URL
   */
  private getScreenshotFilename(url: string): string {
    const parsed = new URL(url);
    let pathname = parsed.pathname.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!pathname || pathname === '_') pathname = 'index';
    return `${pathname}_${Date.now()}.png`;
  }

  /**
   * Take a screenshot of the page
   */
  private async takeScreenshot(page: Page, url: string): Promise<string | undefined> {
    try {
      const filename = this.getScreenshotFilename(url);
      const filepath = path.join(this.config.screenshotDir, filename);

      await page.screenshot({
        path: filepath,
        fullPage: this.config.fullPageScreenshots,
        type: 'png',
      });

      return filepath;
    } catch (error) {
      console.error(`Failed to take screenshot for ${url}:`, error);
      return undefined;
    }
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(page: Page, url: string): Promise<PageData | null> {
    const normalizedUrl = this.normalizeUrl(url);

    if (this.visitedUrls.has(normalizedUrl)) {
      return null;
    }

    this.visitedUrls.add(normalizedUrl);
    const pageStartTime = Date.now();

    logCrawling(url, this.visitedUrls.size, this.config.maxPages, this.config.verbose);

    const startTime = Date.now();
    let statusCode = 200;

    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      statusCode = response?.status() || 200;

      // Wait for any dynamic content
      await page.waitForTimeout(500);

      // Disable animations before taking screenshot
      if (this.config.disableAnimations) {
        await disablePageAnimations(page);
        // Small wait for animations to settle after disabling
        await page.waitForTimeout(100);
      }

      const loadTime = Date.now() - startTime;

      // Take screenshot
      const screenshotPath = await this.takeScreenshot(page, url);
      if (screenshotPath) {
        logScreenshot(this.config.verbose);
      }

      // Extract page data
      const pageData = await extractPageData(
        page,
        url,
        this.config.baseUrl,
        screenshotPath,
        statusCode,
        loadTime
      );

      // Log detected technologies
      if (pageData.technologies.length > 0) {
        logTechnologies(
          pageData.technologies.map(t => t.name),
          this.config.verbose
        );
      }

      // Download assets if enabled
      if (this.config.downloadAssets && this.config.downloadImages && pageData.images.length > 0) {
        await this.downloadPageAssets(pageData, url);
      }

      // Queue internal links for crawling
      const internalLinks = pageData.links
        .filter(link => link.isInternal && this.shouldCrawl(link.href))
        .map(link => link.href);

      for (const link of internalLinks) {
        if (!this.urlsToVisit.includes(link)) {
          this.urlsToVisit.push(link);
        }
      }

      const pageDuration = (Date.now() - pageStartTime) / 1000;
      logPageComplete(pageDuration, this.config.verbose);

      return pageData;
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      return {
        url,
        title: '',
        textContent: '',
        headings: [],
        links: [],
        images: [],
        structure: [],
        technologies: [],
        statusCode: 0,
        loadTime: Date.now() - startTime,
        scrapedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Download assets for a page
   */
  private async downloadPageAssets(pageData: PageData, url: string): Promise<void> {
    const imageUrls = pageData.images
      .map(img => img.src)
      .filter(src => src && !src.startsWith('data:'));

    if (imageUrls.length === 0) return;

    logAssetDownload('images', imageUrls.length, this.config.verbose);

    // Create images directory in screenshot folder
    const imagesDir = path.join(this.config.screenshotDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const results = await downloadAssets(imageUrls, imagesDir, {
      timeout: this.config.assetTimeout,
      maxSize: this.config.maxAssetSize,
      baseUrl: url,
      onProgress: (completed, total, result) => {
        if (result.success && result.localPath) {
          const filename = path.basename(result.localPath);
          logDownloaded(filename, formatBytes(result.size || 0), this.config.verbose);
        } else if (!result.success && result.error) {
          const filename = result.url.split('/').pop() || 'unknown';
          logDownloadFailed(filename, result.error, this.config.verbose);
        }
      },
    });

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    if (this.config.verbose && (successful > 0 || failed > 0)) {
      console.log(`  Downloaded: ${successful} | Failed: ${failed}`);
    }
  }

  /**
   * Aggregate technologies across all pages
   */
  private aggregateTechnologies(pages: PageData[]): TechnologyInfo[] {
    const techMap = new Map<string, TechnologyInfo>();

    for (const page of pages) {
      for (const tech of page.technologies) {
        const existing = techMap.get(tech.name);
        if (!existing || tech.confidence === 'high') {
          techMap.set(tech.name, tech);
        }
      }
    }

    return Array.from(techMap.values());
  }

  /**
   * Build site structure from pages
   */
  private buildSiteStructure(pages: PageData[]): SiteReport['siteStructure'] {
    return pages.map(page => {
      const children = page.links
        .filter(link => link.isInternal)
        .map(link => link.href);

      return {
        url: page.url,
        title: page.title,
        children: [...new Set(children)],
      };
    });
  }

  /**
   * Start the crawling process
   */
  async crawl(): Promise<SiteReport> {
    this.startTime = new Date();
    this.ensureDirectories();

    console.log(`Starting crawl of ${this.config.baseUrl}`);
    console.log(`Max pages: ${this.config.maxPages}`);
    console.log(`Screenshots: ${this.config.screenshotDir}`);
    console.log(`Output: ${this.config.outputDir}`);
    console.log('---');

    await this.initBrowser();

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const context = await this.browser.newContext({
      viewport: {
        width: this.config.viewportWidth,
        height: this.config.viewportHeight,
      },
      userAgent: 'Mozilla/5.0 (compatible; SiteScraperBot/1.0; +https://github.com/MacphersonDesigns/site-scraper)',
    });

    const page = await context.newPage();

    // Start with base URL
    this.urlsToVisit.push(this.config.baseUrl);

    try {
      while (
        this.urlsToVisit.length > 0 &&
        (this.config.maxPages === 0 || this.pages.length < this.config.maxPages)
      ) {
        const url = this.urlsToVisit.shift()!;

        const pageData = await this.crawlPage(page, url);
        if (pageData) {
          this.pages.push(pageData);
        }

        // Delay between requests
        if (this.urlsToVisit.length > 0 && this.config.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.delay));
        }
      }
    } finally {
      await context.close();
      await this.closeBrowser();
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - this.startTime.getTime()) / 1000;

    const report: SiteReport = {
      baseUrl: this.config.baseUrl,
      totalPages: this.pages.length,
      pages: this.pages,
      technologies: this.aggregateTechnologies(this.pages),
      siteStructure: this.buildSiteStructure(this.pages),
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
    };

    // Save report
    await this.saveReport(report);

    console.log('---');
    console.log(`Crawl complete!`);
    console.log(`Pages scraped: ${report.totalPages}`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Technologies detected: ${report.technologies.map(t => t.name).join(', ') || 'None'}`);

    return report;
  }

  /**
   * Save the report to disk
   */
  private async saveReport(report: SiteReport): Promise<void> {
    const reportPath = path.join(this.config.outputDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${reportPath}`);

    // Also save a summary
    const summaryPath = path.join(this.config.outputDir, 'summary.txt');
    const summary = this.generateSummary(report);
    fs.writeFileSync(summaryPath, summary);
    console.log(`Summary saved to: ${summaryPath}`);
  }

  /**
   * Generate a human-readable summary
   */
  private generateSummary(report: SiteReport): string {
    const lines: string[] = [
      '='.repeat(60),
      'SITE SCRAPER REPORT',
      '='.repeat(60),
      '',
      `Base URL: ${report.baseUrl}`,
      `Total Pages: ${report.totalPages}`,
      `Duration: ${report.duration.toFixed(2)} seconds`,
      `Start: ${report.startTime}`,
      `End: ${report.endTime}`,
      '',
      '-'.repeat(60),
      'DETECTED TECHNOLOGIES',
      '-'.repeat(60),
    ];

    if (report.technologies.length === 0) {
      lines.push('No technologies detected');
    } else {
      for (const tech of report.technologies) {
        lines.push(`  - ${tech.name}${tech.version ? ` v${tech.version}` : ''} (${tech.category}, ${tech.confidence} confidence)`);
      }
    }

    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('PAGES SCRAPED');
    lines.push('-'.repeat(60));

    for (const page of report.pages) {
      lines.push(`  ${page.url}`);
      lines.push(`    Title: ${page.title || '(no title)'}`);
      lines.push(`    Links: ${page.links.length} | Images: ${page.images.length} | Load time: ${page.loadTime}ms`);
      if (page.screenshotPath) {
        lines.push(`    Screenshot: ${page.screenshotPath}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Create and run a crawler with the given configuration
 */
export async function crawlSite(config: ScraperConfig): Promise<SiteReport> {
  const crawler = new SiteCrawler(config);
  return crawler.crawl();
}
