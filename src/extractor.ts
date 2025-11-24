import type { Page } from 'playwright';
import type { LinkInfo, ImageInfo, StructuralElement, PageData, TechnologyInfo } from './types';
import { detectTechnologies } from './tech-detector';

/**
 * Extract all links from a page
 */
export async function extractLinks(page: Page, baseUrl: string): Promise<LinkInfo[]> {
  const baseHostname = new URL(baseUrl).hostname;

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map(a => ({
      text: a.textContent?.trim() || '',
      href: a.getAttribute('href') || '',
    }));
  });

  return links.map(link => {
    let isInternal = false;
    let href = link.href;

    try {
      // Handle relative URLs
      if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
        isInternal = true;
        href = new URL(href, baseUrl).href;
      } else if (href.startsWith('#')) {
        isInternal = true;
      } else if (href.startsWith('http')) {
        const linkHostname = new URL(href).hostname;
        isInternal = linkHostname === baseHostname;
      }
    } catch {
      // Invalid URL, treat as external
      isInternal = false;
    }

    return {
      text: link.text,
      href,
      isInternal,
    };
  });
}

/**
 * Extract all images from a page
 */
export async function extractImages(page: Page): Promise<ImageInfo[]> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src || img.getAttribute('data-src') || '',
      alt: img.alt || '',
      width: img.naturalWidth || img.width || undefined,
      height: img.naturalHeight || img.height || undefined,
    }));
  });
}

/**
 * Extract headings from a page
 */
export async function extractHeadings(page: Page): Promise<{ level: number; text: string }[]> {
  return page.evaluate(() => {
    const headings: { level: number; text: string }[] = [];
    for (let i = 1; i <= 6; i++) {
      const elements = document.querySelectorAll(`h${i}`);
      elements.forEach(el => {
        headings.push({
          level: i,
          text: el.textContent?.trim() || '',
        });
      });
    }
    return headings;
  });
}

/**
 * Extract structural elements from a page
 */
export async function extractStructure(page: Page): Promise<StructuralElement[]> {
  return page.evaluate(() => {
    const structuralTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer', 'form'];
    const elements: StructuralElement[] = [];

    structuralTags.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => {
        elements.push({
          tag,
          id: el.id || undefined,
          classes: Array.from(el.classList),
          text: tag === 'form' ? undefined : el.textContent?.substring(0, 200).trim(),
          childCount: el.children.length,
        });
      });
    });

    // Also get divs with significant IDs or roles
    document.querySelectorAll('div[id], div[role]').forEach(el => {
      const div = el as HTMLDivElement;
      if (div.id || div.getAttribute('role')) {
        elements.push({
          tag: 'div',
          id: div.id || undefined,
          classes: Array.from(div.classList),
          childCount: div.children.length,
        });
      }
    });

    return elements;
  });
}

/**
 * Extract text content from a page
 */
export async function extractTextContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    // Remove script and style elements from consideration
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

    // Get text content and clean it up
    return clone.textContent
      ?.replace(/\s+/g, ' ')
      .trim() || '';
  });
}

/**
 * Extract page metadata
 */
export async function extractMetadata(page: Page): Promise<{ title: string; metaDescription?: string }> {
  return page.evaluate(() => {
    const title = document.title || '';
    const metaDesc = document.querySelector('meta[name="description"]');
    const metaDescription = metaDesc?.getAttribute('content') || undefined;

    return { title, metaDescription };
  });
}

/**
 * Extract all data from a single page
 */
export async function extractPageData(
  page: Page,
  url: string,
  baseUrl: string,
  screenshotPath?: string,
  statusCode: number = 200,
  loadTime: number = 0
): Promise<PageData> {
  const [
    metadata,
    textContent,
    headings,
    links,
    images,
    structure,
    technologies,
  ] = await Promise.all([
    extractMetadata(page),
    extractTextContent(page),
    extractHeadings(page),
    extractLinks(page, baseUrl),
    extractImages(page),
    extractStructure(page),
    detectTechnologies(page),
  ]);

  return {
    url,
    title: metadata.title,
    metaDescription: metadata.metaDescription,
    textContent,
    headings,
    links,
    images,
    structure,
    screenshotPath,
    technologies,
    statusCode,
    loadTime,
    scrapedAt: new Date().toISOString(),
  };
}
