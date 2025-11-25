import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { disablePageAnimations } from '../src/utils/animations';
import { sanitizeFilename, formatBytes } from '../src/utils/assets';

describe('Utils - Animations', () => {
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

  it('should inject CSS to disable animations', async () => {
    await page.setContent(`
      <html>
        <head>
          <style>
            .animated {
              animation: fadeIn 2s ease-in;
              transition: opacity 1s;
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          </style>
        </head>
        <body>
          <div class="animated">Test</div>
        </body>
      </html>
    `);

    await disablePageAnimations(page);

    // Check that animation-duration is 0s
    const styles = await page.evaluate(() => {
      const div = document.querySelector('.animated');
      if (!div) return null;
      const computed = window.getComputedStyle(div);
      return {
        animationDuration: computed.animationDuration,
        transitionDuration: computed.transitionDuration,
      };
    });

    expect(styles).not.toBeNull();
    expect(styles?.animationDuration).toBe('0s');
    expect(styles?.transitionDuration).toBe('0s');
  });

  it('should override requestAnimationFrame', async () => {
    await page.setContent('<html><body></body></html>');
    await disablePageAnimations(page);

    const result = await page.evaluate(() => {
      let called = false;
      const returnValue = window.requestAnimationFrame(() => {
        called = true;
      });
      return { called, returnValue };
    });

    // After disabling, requestAnimationFrame should immediately call the callback
    expect(result.called).toBe(true);
    expect(result.returnValue).toBe(0);
  });
});

describe('Utils - Assets', () => {
  describe('sanitizeFilename', () => {
    it('should extract filename from URL path', () => {
      expect(sanitizeFilename('/images/logo.png')).toBe('logo.png');
      expect(sanitizeFilename('/path/to/image.jpg')).toBe('image.jpg');
    });

    it('should remove query strings and hashes', () => {
      expect(sanitizeFilename('/image.png?v=123')).toBe('image.png');
      expect(sanitizeFilename('/image.png#section')).toBe('image.png');
    });

    it('should replace invalid characters', () => {
      expect(sanitizeFilename('/image<>:file.png')).toBe('image___file.png');
    });

    it('should handle empty or invalid paths', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('/')).toBe('unnamed');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(250) + '.png';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith('.png')).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
    });
  });
});
