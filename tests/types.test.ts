import { describe, it, expect } from 'vitest';
import type { ScraperConfig, PageData, SiteReport } from '../src/types';

describe('Types', () => {
  it('should allow valid ScraperConfig', () => {
    const config: ScraperConfig = {
      baseUrl: 'https://example.com',
      maxPages: 10,
      screenshotDir: './screenshots',
      outputDir: './output',
      delay: 500,
      screenshotQuality: 90,
      fullPageScreenshots: true,
      viewportWidth: 1920,
      viewportHeight: 1080,
    };

    expect(config.baseUrl).toBe('https://example.com');
    expect(config.maxPages).toBe(10);
  });

  it('should require only baseUrl in ScraperConfig', () => {
    const config: ScraperConfig = {
      baseUrl: 'https://example.com',
    };

    expect(config.baseUrl).toBeDefined();
    expect(config.maxPages).toBeUndefined();
  });

  it('should validate PageData structure', () => {
    const pageData: PageData = {
      url: 'https://example.com',
      title: 'Example',
      textContent: 'Hello World',
      headings: [{ level: 1, text: 'Title' }],
      links: [{ text: 'Link', href: 'https://example.com/page', isInternal: true }],
      images: [{ src: 'https://example.com/img.jpg', alt: 'Image' }],
      structure: [{ tag: 'header', classes: [], childCount: 2 }],
      technologies: [{ name: 'React', category: 'framework', confidence: 'high' }],
      statusCode: 200,
      loadTime: 1500,
      scrapedAt: new Date().toISOString(),
    };

    expect(pageData.url).toBe('https://example.com');
    expect(pageData.technologies[0].name).toBe('React');
    expect(pageData.links[0].isInternal).toBe(true);
  });

  it('should validate SiteReport structure', () => {
    const report: SiteReport = {
      baseUrl: 'https://example.com',
      totalPages: 5,
      pages: [],
      technologies: [],
      siteStructure: [],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 10.5,
    };

    expect(report.totalPages).toBe(5);
    expect(report.duration).toBe(10.5);
  });
});
